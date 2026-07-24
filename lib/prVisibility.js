// Shared PR row-visibility rule (issue #119, extracted in #132). One source
// of truth for "may this user see this PR" — used by the submitted-PR list
// (app/prs/page.js) to filter rows, and by the PO detail page
// (app/pos/[poId]/page.js) to gate viewing a PO by its parent PR. Pure: no
// Airtable calls, callers pass the already-loaded user and PR.
//
// Rule: President/Admin see everything; any other active user sees a PR only
// if they raised it OR it's on one of their assigned Jobs. Optional chaining
// keeps it safe for a PR missing a requester/job (it simply fails both
// ownership checks — the safe default); an empty Assigned Jobs list still
// leaves the "raised it" half, so a user always sees their own.

export function canViewPR(user, pr) {
    if (!user || !pr) return false;
    if (user.role === "President" || user.isAdmin === true) return true;
    if (pr.requester?.[0] === user.id) return true;
    return (user.assignedJobs || []).includes(pr.job?.[0]);
}
