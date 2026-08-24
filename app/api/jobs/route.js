import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { withOpsLabel } from "@/lib/airtableOps";

// Issue #272. Backs the Job picker inside `/invoices/new`'s direct-purchase
// modal, and exists so that picker costs the PAGE nothing: the office opens the
// modal on the rare invoice that has no order to charge, and putting
// `getAllJobs()` in the page's own load would spend a read on every one of the
// far more common loads that never reach it. Same shape and same reason as
// `GET /api/pos/search` (#57), which is the other thing this form fetches only
// when a reader asks for it — and the label means the cost shows up in its own
// row rather than inside the page's.
//
// Admin-only, matching the form that is its only consumer: a Route Handler is
// directly callable, so the gate cannot be left to the page. #147 — the gate IS
// the wrapper, so there is no returned refusal for this file to forget to act on.
//
// THE PROJECTION IS THE PICKER'S, not the Job record's. `getAllJobs` also carries
// three reverse-link arrays that other callers walk; sending them to a browser
// would be record ids nobody there can use.
export const GET = withAdminApi(async () => {
    return withOpsLabel("GET /api/jobs", async () => {
        const jobs = await getAllJobs();
        return NextResponse.json({
            jobs: jobs.map((job) => ({
                id: job.id,
                jobCode: job.jobCode,
                jobName: job.jobName,
            })),
        });
    });
});
