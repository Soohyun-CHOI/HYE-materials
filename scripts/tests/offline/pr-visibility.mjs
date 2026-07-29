// canViewPR — the row-visibility rule the PR list and the PO detail page share.
//
// Extracted by #152 from verify-po-visibility-132.mjs Part A. It was already a
// pure-function check with no Airtable in it, but it sat in a file that imports
// lib/airtable/* at the top level, so running it meant supplying credentials
// and letting the rest of that script create a throwaway PR+PO. It belongs in
// the tier that runs on every push instead.
//
// lib/prVisibility.js imports nothing, so this is the real production function
// (issues #119, extracted in #132). A false result is what both call sites turn
// into "not found" — never a hidden link — so these decisions are the gate.

import { canViewPR } from "../../../lib/prVisibility.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Row visibility — canViewPR decisions (#119/#132)";

export function run({ check }) {
    const president = { id: "recPres", role: "President", isAdmin: false, assignedJobs: [] };
    const admin = { id: "recAdmin", role: "Employee", isAdmin: true, assignedJobs: [] };
    const employee = { id: "recEmp", role: "Employee", isAdmin: false, assignedJobs: ["recJobA"] };

    const prOfEmployee = { requester: ["recEmp"], job: ["recJobZ"] }; // employee raised it
    const prOnAssignedJob = { requester: ["recOther"], job: ["recJobA"] }; // on employee's job
    const prUnrelated = { requester: ["recOther"], job: ["recJobZ"] }; // neither

    // Privileged: everything.
    check("President sees an unrelated PR", canViewPR(president, prUnrelated), true);
    check("Admin sees an unrelated PR", canViewPR(admin, prUnrelated), true);
    // (a) their own PR.
    check("Employee sees a PR they raised", canViewPR(employee, prOfEmployee), true);
    // (b) their assigned Job.
    check("Employee sees a PR on their assigned Job", canViewPR(employee, prOnAssignedJob), true);
    // (c) unrelated -> both call sites render this as not-found.
    check("Employee DENIED an unrelated PR", canViewPR(employee, prUnrelated), false);
    // A PR missing a requester/job must fail both ownership tests rather than
    // throwing, and an empty Assigned Jobs list must still leave "raised it".
    check("null user denied", canViewPR(null, prUnrelated), false);
    check("null pr denied", canViewPR(employee, null), false);
    check("PR with no requester or job denied", canViewPR(employee, {}), false);
    check(
        "employee with no assigned jobs still sees their own",
        canViewPR({ id: "recEmp", role: "Employee", isAdmin: false }, prOfEmployee),
        true
    );
}

if (isMain(import.meta.url)) standalone(title, run);
