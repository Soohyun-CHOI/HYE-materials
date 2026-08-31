import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getSubmittedPRs } from "@/lib/airtable/purchaseRequests";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { canViewPR } from "@/lib/prVisibility";
import { prKind } from "@/lib/prKind";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import { getOveragesAwaitingRequest } from "@/lib/overagePR";
import { getDirectPurchasesAwaitingRequest } from "@/lib/directPurchaseClaim";
import { withOpsLabel } from "@/lib/airtableOps";
import PRListClient from "./PRListClient";
import OverageStrip from "./OverageStrip";
import DirectPurchaseStrip from "./DirectPurchaseStrip";

export const metadata = { title: "Purchase Requests" };

// Withdrawn (issue #122) is a real submitted-PR status, so it's a filter
// option here too — getSubmittedPRs returns Withdrawn PRs (they aren't
// Drafts), and this list keeps them visible/distinguishable.
const STATUSES = ["In Review", "Approved", "PO Signed", "Withdrawn"];

// Open to any active user (issue #119) — unlike the invoice list, this is a
// floor-level view. The SERVER decides which PRs a user may see and sends only
// those down; the client (PRListClient) does the instant narrow-filtering
// within that set, so it can never surface a PR the user isn't allowed to see.
// The label is a one-line wrapper around the render rather than a block around
// its body, so the page's own logic keeps its indentation and the diff that
// introduced counting stays readable (#190). The label is the route TEMPLATE, so
// repeated loads aggregate into one row.
export default async function PRListPage(props) {
    return withOpsLabel("/prs", () => renderPRListPage(props));
}

async function renderPRListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const isPrivileged = user.role === "President" || user.isAdmin === true;

    // #314 — `getAllDisciplines()` WAS THE FOURTH AND IS GONE WITH THE COLUMN. It
    // bought one thing, the Discipline NAME for the `Job / Discipline` cell, and this
    // list heads `Job` now: a discipline is how a request is FILED rather than where
    // the material went, so it belongs to the documents that hold one and not to the
    // row a reader scans. It is on this request's own screen, beside its job.
    // Removing the render and leaving the read would have cost this page an operation
    // for nothing and broken nothing — `offline/job-column.mjs` is what asserts the
    // read went with it.
    const [allPRs, jobs, vendors] = await Promise.all([
        getSubmittedPRs(),
        getAllJobs(),
        getAllVendors(),
    ]);

    const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const vendorsById = Object.fromEntries(vendors.map((v) => [v.id, v.vendorName]));

    // SERVER-SIDE VISIBILITY GATE (#119) — the security boundary, never moved
    // to the client. The per-PR rule lives in canViewPR (lib/prVisibility.js,
    // extracted in #132) so the PO detail page gates on exactly the same rule:
    // President/Admin see everything, anyone else sees PRs they raised or on
    // their assigned job(s).
    const myJobIds = new Set(user.assignedJobs || []);
    const visible = allPRs.filter((pr) => canViewPR(user, pr));

    // Job filter options are limited to jobs the user can access, so the
    // client filter can only narrow within the visible set, never widen it.
    const accessibleJobs = isPrivileged ? jobs : jobs.filter((j) => myJobIds.has(j.id));
    const accessibleJobIds = new Set(accessibleJobs.map((j) => j.id));

    // Resolve requester names for the whole visible set (the client filters
    // after, so names are needed for every visible row, not a subset).
    //
    // Issue #193 — read in ONE query below rather than one find per requester,
    // which is the shape that grew with the rows on the page. This list is already
    // distinct, so batching changes nothing else about it.
    const requesterIds = [...new Set(visible.map((pr) => pr.requester?.[0]).filter(Boolean))];
    // Issue #217 — the strip's rows, read alongside the requester names rather than
    // after them, so the strip costs the page no extra round trip. ITS ROWS ARE
    // GATED BY THE DELIVERY RULE, NOT THIS PAGE'S: the table is purchase requests
    // under canViewPR and these are deliveries under canAccessJobDeliveries, which
    // admit different people — see getOveragesAwaitingRequest for why the delivery rule
    // is the right one here (createOverageDraftAction re-authorizes on it, so any
    // other gate would render a button the action refuses). The accessible jobs are
    // narrowed before the read, so a delivery on a job this viewer cannot reach is
    // never fetched.
    // #272 — the second strip's rows, read alongside the first for the same reason:
    // both walks take the jobs this page has already narrowed, so neither costs a
    // round trip of its own and neither can fetch a record on a job the viewer cannot
    // reach. The vendors are passed in as well — this page loads them for its own
    // column, so naming a direct purchase's vendor costs no query.
    const [requesterRecords, overages, directPurchases] = await Promise.all([
        getUsersByRecordIds(requesterIds),
        getOveragesAwaitingRequest(jobsFor(user, jobs)),
        getDirectPurchasesAwaitingRequest(jobsFor(user, jobs), vendors),
    ]);
    const userNameById = Object.fromEntries(
        requesterRecords.filter(Boolean).map((u) => [u.id, u.userName])
    );

    // Pre-shape each visible PR into a plain, display-ready row. jobId /
    // status / isMine are the keys the client's narrow filters use — isMine is
    // resolved here so the requester's identity never has to go to the client.
    const rows = visible.map((pr) => ({
        id: pr.id,
        prId: pr.prId,
        status: pr.status,
        isMine: pr.requester?.[0] === user.id,
        requesterName: userNameById[pr.requester?.[0]] || "—",
        vendorName: vendorsById[pr.vendor?.[0]] || "—",
        jobId: pr.job?.[0] ?? null,
        jobCode: jobsById[pr.job?.[0]]?.jobCode || null,
        total: pr.totalAmount ?? pr.itemsSubtotal ?? 0,
        // Issue #272 — FREE, and that is why it is here rather than in the client:
        // both reverse-links the kind is read from are already on the record
        // getSubmittedPRs returned, so this costs no query and no round trip. The
        // judgment runs on the server and the browser reads a key, which is the
        // arrangement #198 uses for an unsigned order.
        kind: prKind(pr),
    }));

    const jobOptions = accessibleJobs.map((j) => ({
        id: j.id,
        jobCode: j.jobCode,
        jobName: j.jobName,
    }));

    // Initial narrow-filter state, parsed from the URL so refresh / shared
    // link / back-button restore it (the client keeps the URL in sync via
    // router.replace). The job filter is intersected with accessible jobs
    // here too, so a forged ?job in a pasted URL is dropped before it ever
    // reaches the client. A fresh page load / back navigation remounts the
    // client, which seeds its state from these props; router.replace updates
    // during use don't remount it (no key), so the open dropdown / search /
    // scroll are preserved as filters change.
    const rawJob = sp.job;
    const initialSelectedJobs = (Array.isArray(rawJob) ? rawJob : rawJob ? [rawJob] : []).filter(
        (id) => accessibleJobIds.has(id)
    );
    const initialStatus = STATUSES.includes(sp.status) ? sp.status : "";
    const initialMine = sp.mine === "1";

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Purchase Requests</h1>
                <Link href="/prs/new" className="rounded bg-foreground px-3 py-2 text-sm text-background">
                    New PR
                </Link>
            </div>

            {/* Issue #217 — above the list, because it is about requests that do not
                exist yet: the same reason #176's strip is a strip rather than a
                column, since the row that would carry the fact is the thing missing. */}
            <OverageStrip rows={overages} />
            {/* #272 — second, and deliberately weakly so: neither list outranks the
                other, so the strip people already know keeps its position. Both are
                material the company holds with no request behind it. */}
            <DirectPurchaseStrip rows={directPurchases} />

            <PRListClient
                rows={rows}
                jobOptions={jobOptions}
                statuses={STATUSES}
                initialSelectedJobs={initialSelectedJobs}
                initialStatus={initialStatus}
                initialMine={initialMine}
            />
        </div>
    );
}
