// Row visibility for deliveries (#162) — the delivery-side counterpart of
// lib/prVisibility.js, and its own module for the same reason: five surfaces
// need this one answer (the entry page, the create action, the list, the detail
// page, and the two in-place edit actions), so a second implementation would be
// five chances to disagree.
//
// Pure and dependency-free — callers pass an already-loaded user — so
// scripts/tests/offline/delivery-allocation.mjs can pin it with no credentials,
// and so no surface pays a query to ask.

/**
 * May this user see and record deliveries on this Job?
 *
 * Assigned to the Job, or President/Admin.
 *
 * The Job is the whole scope. A delivery is not a document anyone signs and
 * carries no approval chain, so there is nothing here like canViewPR's clauses 5
 * and 6 — no participant who would be locked out of their own turn. What a
 * delivery does carry is a claim about a specific site, and the people who work
 * that site are exactly who should see and make such claims.
 *
 * President/Admin are included deliberately. #162 scopes entry to "anyone
 * assigned to the Job", which is a floor rather than a ceiling: every other
 * row-level rule in this app admits them (canViewPR clause 2), invoicing and
 * reconciliation are office work, and an Admin can already DELETE a delivery.
 * Admitting the office to deletion but not to entry would be an inconsistency
 * with no reason behind it.
 *
 * A missing `assignedJobs` is treated as an empty list rather than throwing.
 * This differs from canViewPR on purpose: there, the arrays feed clauses that
 * exist to keep a signing chain moving, so a caller that omitted them would
 * silently stall the chain and the throw is a tripwire. Here the only
 * consequence of an empty list is that a non-office user sees nothing, which is
 * both the safe direction and a visible one — they are looking at an empty page,
 * not at a workflow that has quietly stopped.
 */
export function canAccessJobDeliveries(user, jobRecordId) {
    if (!user || !jobRecordId) return false;
    if (user.role === "President" || user.isAdmin === true) return true;
    return (user.assignedJobs || []).includes(jobRecordId);
}

/**
 * The Jobs whose deliveries this user may reach, out of an already-loaded list.
 *
 * Exists so the list and the entry page narrow their Job pickers through the
 * same predicate above rather than each re-deriving the office short-circuit —
 * which is the specific way the PR list's Job filter came to disagree with its
 * own row rule (CLAUDE.md records that as an open follow-up).
 */
export function accessibleJobs(user, jobs) {
    return (jobs || []).filter((job) => canAccessJobDeliveries(user, job.id));
}
