import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getSubmittedPRs } from "@/lib/airtable/purchaseRequests";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { formatUSD } from "@/lib/format";

const STATUSES = ["In Review", "Approved", "PO Signed"];

// Open to any active user (issue #119) — unlike the invoice list, this is a
// floor-level view. Which PRs a user sees is decided by row-level visibility
// below, applied server-side before render, so the client only ever receives
// rows the user is allowed to see.
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

    // Row-level visibility. President/Admin see every submitted PR; a plain
    // Employee sees the union of PRs they raised and PRs on their assigned
    // job(s). Optional chaining keeps this safe for a PR missing a
    // requester/job (a submitted PR always has both — required Line at
    // submission gives the Job lookup — but an unattributable one simply
    // fails both checks, which is the safe default). Empty Assigned Jobs still
    // leaves the requester half of the union, so a user always sees their own.
    const myJobIds = new Set(user.assignedJobs || []);
    const visible = isPrivileged
        ? allPRs
        : allPRs.filter(
              (pr) => pr.requester?.[0] === user.id || myJobIds.has(pr.job?.[0])
          );

    // Job filter options are limited to jobs the user can access, so the
    // filter can only narrow within the visible set, never widen it.
    const accessibleJobs = isPrivileged ? jobs : jobs.filter((j) => myJobIds.has(j.id));
    const accessibleJobIds = new Set(accessibleJobs.map((j) => j.id));

    // Parse filters from the query. A forged/inaccessible job id is dropped
    // (intersected with accessible), and every filter only narrows the
    // already-visibility-filtered `visible` set.
    const rawJob = sp.job;
    const selectedJobs = (Array.isArray(rawJob) ? rawJob : rawJob ? [rawJob] : []).filter((id) =>
        accessibleJobIds.has(id)
    );
    const mine = sp.mine === "1";
    const status = STATUSES.includes(sp.status) ? sp.status : "";

    let rows = visible;
    if (selectedJobs.length) rows = rows.filter((pr) => selectedJobs.includes(pr.job?.[0]));
    if (mine) rows = rows.filter((pr) => pr.requester?.[0] === user.id);
    if (status) rows = rows.filter((pr) => pr.status === status);

    // Resolve requester names for just the rows shown (distinct ids).
    const requesterIds = [...new Set(rows.map((pr) => pr.requester?.[0]).filter(Boolean))];
    const requesterRecords = await Promise.all(requesterIds.map((id) => getUserByRecordId(id)));
    const userNameById = Object.fromEntries(
        requesterRecords.filter(Boolean).map((u) => [u.id, u.userName])
    );

    const filtersActive = selectedJobs.length > 0 || mine || status;

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Purchase Requests</h1>
                <Link href="/prs/new" className="rounded bg-foreground px-3 py-2 text-sm text-background">
                    New PR
                </Link>
            </div>

            <form method="get" className="mt-6 space-y-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                {accessibleJobs.length > 0 && (
                    <fieldset>
                        <legend className="font-medium">Jobs</legend>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {accessibleJobs.map((j) => (
                                <label key={j.id} className="flex items-center gap-1">
                                    <input
                                        type="checkbox"
                                        name="job"
                                        value={j.id}
                                        defaultChecked={selectedJobs.includes(j.id)}
                                    />
                                    {j.jobCode} — {j.jobName}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-1">
                        <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
                        Raised by me
                    </label>
                    <label className="flex items-center gap-1">
                        Status:
                        <select name="status" defaultValue={status} className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black">
                            <option value="">All</option>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
                        Apply
                    </button>
                    {filtersActive && (
                        <Link href="/prs" className="underline">
                            Clear
                        </Link>
                    )}
                </div>
            </form>

            {rows.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {filtersActive ? "No PRs match these filters." : "No purchase requests to show."}
                </p>
            ) : (
                <table className="mt-6 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">PR ID</th>
                            <th className="pr-2">Requester</th>
                            <th className="pr-2">Vendor</th>
                            <th className="pr-2">Job / Line</th>
                            <th className="pr-2 text-right">Total</th>
                            <th className="pr-2">Status</th>
                            <th className="pr-2">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((pr) => {
                            const job = jobsById[pr.job?.[0]];
                            const line = linesById[pr.line?.[0]];
                            return (
                                <tr key={pr.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                    <td className="py-1 pr-2">
                                        <Link href={`/prs/${pr.prId}`} className="underline">
                                            {pr.prId}
                                        </Link>
                                    </td>
                                    <td className="py-1 pr-2">{userNameById[pr.requester?.[0]] || "—"}</td>
                                    <td className="py-1 pr-2">{vendorsById[pr.vendor?.[0]] || "—"}</td>
                                    <td className="py-1 pr-2">
                                        {job ? job.jobCode : "—"}
                                        {line ? ` · ${line.lineName}` : ""}
                                    </td>
                                    <td className="py-1 pr-2 text-right">
                                        {formatUSD(pr.totalAmount ?? pr.itemsSubtotal)}
                                    </td>
                                    <td className="py-1 pr-2">{pr.status}</td>
                                    <td className="py-1 pr-2">
                                        {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
