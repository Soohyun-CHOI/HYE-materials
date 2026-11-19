import Link from "next/link";
import { redirect } from "next/navigation";
import UndrawnPage from "@/app/components/UndrawnPage";
import { requireUser } from "@/lib/authz";
import { withOpsLabel } from "@/lib/airtableOps";
import { getAllJobs } from "@/lib/airtable/jobs";
import { INVENTORY_COPY, inventoryJobs, inventoryPath } from "@/lib/materialStock";

/**
 * Inventory (#675): the jobs whose materials this reader may see — every job for an Admin, a
 * site manager's own — each opening its list. A reader with one goes straight to it.
 *
 * A JOB THAT HAS CLOSED IS STILL LISTED. Closing a job ends its work and stops it being offered
 * where a job is newly chosen (`lib/closedJob.js`); what was delivered there and not used is
 * still there, and it is still issued from.
 */
export default async function InventoryPage(props) {
    return withOpsLabel("/materials", () => renderInventoryPage(props));
}

async function renderInventoryPage() {
    const user = await requireUser();
    const jobs = inventoryJobs(user, await getAllJobs());
    if (jobs.length === 1) redirect(inventoryPath(jobs[0].jobCode));

    return (
        <UndrawnPage measure="list">
            <h1 className="text-2xl font-semibold">{INVENTORY_COPY.heading}</h1>
            {jobs.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">{INVENTORY_COPY.jobs.none}</p>
            ) : (
                <>
                    <p className="mt-2 text-sm text-zinc-600">{INVENTORY_COPY.jobs.lead}</p>
                    <ul className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
                        {jobs.map((job) => (
                            <li key={job.id} className="py-2">
                                <Link href={inventoryPath(job.jobCode)} className="underline">
                                    {job.jobCode}
                                </Link>
                                {job.jobName ? <span className="ml-2 text-zinc-600">{job.jobName}</span> : null}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </UndrawnPage>
    );
}
