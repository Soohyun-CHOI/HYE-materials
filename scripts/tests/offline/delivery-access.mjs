// Delivery row visibility (#162) — Job membership, or the office.
//
// Five surfaces ask this one question (the entry page, the create action, the
// list, the detail page, and the two in-place edit actions), so the rule's value
// is entirely in there being ONE of it. These checks pin what it answers; the
// endpoint inventory in authz-structure.mjs pins that each of those surfaces
// actually calls it.
//
// Offline-safe: lib/deliveryAccess.js imports nothing.

import { accessibleJobs, canAccessJobDeliveries } from "../../../lib/deliveryAccess.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery access — Job membership or the office (#162)";

const JOB_A = "recJobA";
const JOB_B = "recJobB";

const siteStaff = { id: "recU1", role: "Employee", isAdmin: false, assignedJobs: [JOB_A] };
const otherSite = { id: "recU2", role: "Employee", isAdmin: false, assignedJobs: [JOB_B] };
const unassigned = { id: "recU3", role: "Employee", isAdmin: false, assignedJobs: [] };
const admin = { id: "recU4", role: "Employee", isAdmin: true, assignedJobs: [] };
const president = { id: "recU5", role: "President", isAdmin: false, assignedJobs: [] };

export function run({ check, assert, log }) {
    log("Assigned to the Job:");
    check("their own job", canAccessJobDeliveries(siteStaff, JOB_A), true);
    check("not someone else's", canAccessJobDeliveries(siteStaff, JOB_B), false);
    check("a user on no job reaches nothing", canAccessJobDeliveries(unassigned, JOB_A), false);

    log("");
    log("The office reaches every job, on both flags:");
    // Deliberate, and beyond the letter of "anyone assigned to the Job": every
    // other row-level rule in this app admits them (canViewPR clause 2), and an
    // Admin can already DELETE a delivery, so refusing entry would be an
    // inconsistency with no reason behind it.
    check("Admin, assigned to nothing", canAccessJobDeliveries(admin, JOB_A), true);
    check("President, assigned to nothing", canAccessJobDeliveries(president, JOB_B), true);

    log("");
    log("Missing inputs refuse rather than throw:");
    // Unlike canViewPR, which throws for an absent link array — there the arrays
    // feed clauses that keep a signing chain moving, so a silent refusal would
    // stall it invisibly. Here refusing just means an empty page, which is both
    // the safe direction and a visible one.
    check("no user", canAccessJobDeliveries(null, JOB_A), false);
    check("no job", canAccessJobDeliveries(siteStaff, null), false);
    check("neither", canAccessJobDeliveries(null, null), false);
    check("undefined user", canAccessJobDeliveries(undefined, JOB_A), false);
    let threw = false;
    try {
        canAccessJobDeliveries({ id: "x", role: "Employee", isAdmin: false }, JOB_A);
    } catch {
        threw = true;
    }
    assert("a user with no assignedJobs array does not throw", !threw);
    check(
        "and is simply refused",
        canAccessJobDeliveries({ id: "x", role: "Employee", isAdmin: false }, JOB_A),
        false
    );

    log("");
    log("accessibleJobs narrows through the same predicate:");
    const jobs = [{ id: JOB_A, jobCode: "26-A" }, { id: JOB_B, jobCode: "26-B" }];
    check("site staff see only their own", accessibleJobs(siteStaff, jobs).length, 1);
    check("and it is the right one", accessibleJobs(siteStaff, jobs)[0].jobCode, "26-A");
    check("the office sees both", accessibleJobs(admin, jobs).length, 2);
    check("the president too", accessibleJobs(president, jobs).length, 2);
    check("an unassigned employee sees none", accessibleJobs(unassigned, jobs).length, 0);
    check("an empty job list is empty", accessibleJobs(admin, []).length, 0);
    check("a missing job list does not throw", accessibleJobs(admin, undefined).length, 0);

    // The filter cannot widen past the row rule — the specific way the PR list's
    // Job filter came to disagree with its own row rule (CLAUDE.md follow-up).
    assert(
        "every job the filter admits also passes the row rule",
        accessibleJobs(otherSite, jobs).every((j) => canAccessJobDeliveries(otherSite, j.id))
    );
    check("and it admits exactly one for that user", accessibleJobs(otherSite, jobs)[0].jobCode, "26-B");
}

if (isMain(import.meta.url)) standalone(title, run);
