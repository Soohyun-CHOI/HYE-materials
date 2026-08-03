import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs, getJobByCode } from "@/lib/airtable/jobs";
import { getDeliveryCandidatesForJob, buildItemOptions } from "@/lib/deliveryCandidates";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import DeliveryForm from "./DeliveryForm";

/**
 * Record a delivery (#162).
 *
 * Job-first, because everything else narrows from it: the vendor picker holds
 * only vendors this job ordered from, and the item dropdown only what that vendor
 * supplied. The Job comes in as `?job=<Job Code>` so the page can load that job's
 * candidate lines server-side and hand the whole set to the form, which then
 * narrows client-side — the same "load the level, filter in the client" shape
 * InvoiceForm uses for its vendor-scoped PO list.
 *
 * The candidate lines go to the client on purpose. lib/deliveryAllocation.js is
 * pure, so the form imports the very function the Server Action re-runs and draws
 * an accurate preview with no extra endpoint to authorize. Nothing in the payload
 * is privileged: it is the order lines of a job the viewer is already scoped to.
 */
export default async function NewDeliveryPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const jobCode = sp?.job || "";

    // Entry is open to anyone assigned to the Job, plus the office — narrowed
    // through the same predicate createDeliveryAction re-checks per record, so the
    // picker cannot offer a job the action would then refuse.
    const accessibleJobs = jobsFor(user, await getAllJobs());

    if (accessibleJobs.length === 0) {
        return (
            <div className="mx-auto w-full max-w-3xl p-8">
                <h1 className="text-2xl font-semibold">Record a delivery</h1>
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                    You are not assigned to any job yet, so there is nothing to record a delivery
                    against. An Admin can add you to a job in Airtable.
                </p>
                <Link href="/" className="mt-6 inline-block text-sm underline">
                    Back
                </Link>
            </div>
        );
    }

    const selectedJob = jobCode ? await getJobByCode(jobCode) : null;
    const jobAccessible = selectedJob && accessibleJobs.some((j) => j.id === selectedJob.id);

    // A job the viewer cannot reach reads exactly like one that does not exist —
    // never confirm that a record exists outside someone's scope.
    if (!selectedJob || !jobAccessible) {
        return (
            <div className="mx-auto w-full max-w-3xl p-8">
                <h1 className="text-2xl font-semibold">Record a delivery</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Pick the job the material arrived on.
                </p>
                {jobCode && !jobAccessible && (
                    <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
                        No job {jobCode} found.
                    </p>
                )}
                <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {accessibleJobs.map((job) => (
                        <li key={job.id}>
                            <Link
                                href={`/deliveries/new?job=${encodeURIComponent(job.jobCode)}`}
                                className="block py-3 text-sm hover:underline"
                            >
                                <span className="font-medium">{job.jobCode}</span>{" "}
                                <span className="text-zinc-600 dark:text-zinc-400">{job.jobName}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <Link href="/deliveries" className="mt-6 inline-block text-sm underline">
                    All deliveries
                </Link>
            </div>
        );
    }

    const candidates = await getDeliveryCandidatesForJob(selectedJob.id);

    // Pre-shape the item options per vendor on the server so the client does not
    // repeat the grouping, and so a vendor with nothing ordered is visible as an
    // empty list rather than as a missing key.
    const itemsByVendor = Object.fromEntries(
        candidates.vendors.map((v) => [v.id, buildItemOptions(candidates.lines, v.id)])
    );

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <h1 className="text-2xl font-semibold">Record a delivery</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {selectedJob.jobCode} — {selectedJob.jobName}
            </p>

            <DeliveryForm
                jobRecordId={selectedJob.id}
                jobCode={selectedJob.jobCode}
                vendors={candidates.vendors}
                lines={candidates.lines}
                itemsByVendor={itemsByVendor}
            />

            <div className="mt-8 flex gap-4 text-sm">
                <Link href={`/deliveries/new`} className="underline">
                    Change job
                </Link>
                <Link href="/deliveries" className="underline">
                    All deliveries
                </Link>
            </div>
        </div>
    );
}
