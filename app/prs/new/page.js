import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getActiveUsers } from "@/lib/airtable/users";
import PRForm from "./PRForm";

export default async function NewPRPage({ searchParams }) {
    const user = await requireUser();

    const [jobs, lines, vendors, users] = await Promise.all([
        getAllJobs(),
        getAllLines(),
        getAllVendors(),
        getActiveUsers(),
    ]);

    // Phase 1 requirement: default-sort the Job/Line picker toward the
    // Requester's Assigned Jobs, without ever hiding the rest — see
    // CLAUDE.md's "Phase 1 requirement: Line picker defaults to the
    // Requester's Assigned Jobs".
    const assignedJobIds = new Set(user.assignedJobs || []);
    const myJobs = jobs.filter((j) => assignedJobIds.has(j.id));
    const otherJobs = jobs.filter((j) => !assignedJobIds.has(j.id));

    const { created } = await searchParams;

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">New Purchase Request</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created PR {created}.
                </p>
            )}

            <PRForm myJobs={myJobs} otherJobs={otherJobs} lines={lines} vendors={vendors} users={users} />
        </div>
    );
}
