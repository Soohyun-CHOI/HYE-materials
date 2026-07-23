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

    const { created, draft: draftParam } = await searchParams;

    // The Requester's own saved Drafts, most-recent first (Created At, #105),
    // scoped to them by getDraftsByRequester reading their own reverse-link —
    // never anyone else's. Fetched on every load: #74's "Open a saved draft"
    // list needs the full set, and #73's resume prompt needs the most recent.
    const drafts = await getDraftsByRequester(user.id);

    // Issue #74 — lightweight row labels for the list modal, built entirely
    // from getDraftsByRequester's fields (Line/Vendor names resolved from the
    // already-loaded lists) so listing costs no extra per-draft fetches.
    const draftList = drafts.map((d) => ({
        prId: d.prId,
        createdAt: d.createdAt,
        lineLabel: lines.find((l) => l.id === d.line?.[0])?.lineLabel || null,
        vendorName: vendors.find((v) => v.id === d.vendor?.[0])?.vendorName || null,
        total: d.totalAmount ?? d.itemsSubtotal ?? 0,
    }));

    // Which Draft (if any) to hydrate into the form:
    //  - ?draft=<prId>: an explicit pick from the #74 list. Resolve it from
    //    the user's OWN drafts (a forged id for someone else's PR simply
    //    won't match) and auto-hydrate without the resume prompt — the user
    //    already chose it.
    //  - otherwise, on a genuine re-entry (not the ?created reload right
    //    after a submit): offer the most-recent Draft via the #73 resume
    //    prompt.
    const chosenDraft = draftParam
        ? drafts.find((d) => d.prId === draftParam) || null
        : created
          ? null
          : drafts[0] || null;
    const autoResume = Boolean(draftParam && chosenDraft);

    // loadPRDraft (#72) hydrates the full form-state shape — the single load
    // path shared by #73's resume and #74's list pick alike.
    const initialDraft = chosenDraft ? await loadPRDraft(chosenDraft.prId) : null;
    const draftLabel = initialDraft
        ? {
              prId: initialDraft.prId,
              createdAt: chosenDraft.createdAt,
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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">New Purchase Request</h1>
                <Link href="/prs" className="text-sm underline">
                    View all PRs
                </Link>
            </div>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created PR {created}.{" "}
                    <Link href={`/prs/${created}`} className="underline">
                        View it
                    </Link>
                </p>
            )}

            <PRForm
                // Remount when the opened Draft changes: a query-only
                // navigation (?draft=<prId>) reconciles the same client
                // component in place, so without a changing key its useState
                // seed initializers wouldn't re-run for the newly picked draft.
                key={autoResume ? `draft-${chosenDraft.prId}` : "new"}
                myJobs={myJobs}
                otherJobs={otherJobs}
                lines={lines}
                vendors={vendors}
                users={users}
                initialDraft={initialDraft}
                draftLabel={draftLabel}
                autoResume={autoResume}
                draftList={draftList}
            />
        </div>
    );
}
