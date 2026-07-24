import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getSubmittedPRs } from "@/lib/airtable/purchaseRequests";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import PRListClient from "./PRListClient";

// Withdrawn (issue #122) is a real submitted-PR status, so it's a filter
// option here too — getSubmittedPRs returns Withdrawn PRs (they aren't
// Drafts), and this list keeps them visible/distinguishable.
const STATUSES = ["In Review", "Approved", "PO Signed", "Withdrawn"];

// Open to any active user (issue #119) — unlike the invoice list, this is a
// floor-level view. The SERVER decides which PRs a user may see and sends only
// those down; the client (PRListClient) does the instant narrow-filtering
// within that set, so it can never surface a PR the user isn't allowed to see.
export default async function PRListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const isPrivileged = user.role === "President" || user.isAdmin === true;

    const [allPRs, jobs, lines, vendors] = await Promise.all([
        getSubmittedPRs(),
        getAllJobs(),
        getAllLines(),
        getAllVendors(),
    ]);

    const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const linesById = Object.fromEntries(lines.map((l) => [l.id, l]));
    const vendorsById = Object.fromEntries(vendors.map((v) => [v.id, v.vendorName]));

    // SERVER-SIDE VISIBILITY GATE (#119) — the security boundary, never moved
    // to the client. President/Admin see every submitted PR; a plain Employee
    // sees the union of PRs they raised and PRs on their assigned job(s).
    // Optional chaining keeps this safe for a PR missing a requester/job (a
    // submitted PR always has both; an unattributable one simply fails both
    // checks — the safe default). Empty Assigned Jobs still leaves the
    // requester half of the union, so a user always sees their own.
    const myJobIds = new Set(user.assignedJobs || []);
    const visible = isPrivileged
        ? allPRs
        : allPRs.filter((pr) => pr.requester?.[0] === user.id || myJobIds.has(pr.job?.[0]));

    // Job filter options are limited to jobs the user can access, so the
    // client filter can only narrow within the visible set, never widen it.
    const accessibleJobs = isPrivileged ? jobs : jobs.filter((j) => myJobIds.has(j.id));
    const accessibleJobIds = new Set(accessibleJobs.map((j) => j.id));

    // Resolve requester names for the whole visible set (the client filters
    // after, so names are needed for every visible row, not a subset).
    const requesterIds = [...new Set(visible.map((pr) => pr.requester?.[0]).filter(Boolean))];
    const requesterRecords = await Promise.all(requesterIds.map((id) => getUserByRecordId(id)));
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
        lineName: linesById[pr.line?.[0]]?.lineName || null,
        total: pr.totalAmount ?? pr.itemsSubtotal ?? 0,
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
