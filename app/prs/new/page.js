import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllLines } from "@/lib/airtable/lines";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getActiveUsers } from "@/lib/airtable/users";
import { getDraftsByRequester } from "@/lib/airtable/purchaseRequests";
import { loadPRDraft } from "@/lib/prDraft";
import PRForm from "./PRForm";

export default async function NewPRPage({ searchParams }) {
    const user = await requireUser();

    const [jobs, lines, vendors, users] = await Promise.all([
        getAllJobs(),
        getAllLines(),
        getAllVendors(),
        getActiveUsers(),
    ]);

    const { created } = await searchParams;

    // Issue #73 — on a genuine re-entry (not the reload right after a
    // successful submit, which carries ?created), offer to resume the
    // Requester's most-recent Draft. loadPRDraft (#72) hydrates the full
    // form-state shape so the client can resume instantly without a second
    // round trip; only the single most-recent Draft is offered here (the
    // full list is #74) and no other Draft is touched.
    const drafts = created ? [] : await getDraftsByRequester(user.id);
    const mostRecentDraft = drafts[0] || null;
    const initialDraft = mostRecentDraft ? await loadPRDraft(mostRecentDraft.prId) : null;
    const draftLabel = initialDraft
        ? {
              prId: initialDraft.prId,
              createdAt: mostRecentDraft.createdAt,
              lineLabel: lines.find((l) => l.id === initialDraft.lineId)?.lineLabel || null,
              vendorName: vendors.find((v) => v.id === initialDraft.vendorId)?.vendorName || null,
              itemCount: initialDraft.items.length,
          }
        : null;

    // Phase 1 requirement: default-sort the Job/Line picker toward the
    // Requester's Assigned Jobs, without ever hiding the rest — see
    // CLAUDE.md's "Phase 1 requirement: Line picker defaults to the
    // Requester's Assigned Jobs".
    const assignedJobIds = new Set(user.assignedJobs || []);
    const myJobs = jobs.filter((j) => assignedJobIds.has(j.id));
    const otherJobs = jobs.filter((j) => !assignedJobIds.has(j.id));

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">New Purchase Request</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created PR {created}.{" "}
                    <Link href={`/prs/${created}`} className="underline">
                        View it
                    </Link>
                </p>
            )}

            <PRForm
                myJobs={myJobs}
                otherJobs={otherJobs}
                lines={lines}
                vendors={vendors}
                users={users}
                initialDraft={initialDraft}
                draftLabel={draftLabel}
            />
        </div>
    );
}
