import { requireAdmin } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import DisciplineForm from "./DisciplineForm";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "New Discipline" };

// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function NewDisciplinePage(props) {
    return withOpsLabel("/admin/disciplines/new", () => renderNewDisciplinePage(props));
}

async function renderNewDisciplinePage({ searchParams }) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is Admin-only.</p>
            </div>
        );
    }

    const { created } = await searchParams;

    // Issue #30 — the Job picker chooses from existing Jobs (no more free-text
    // Job Code). Whole-list load + a native select is plenty at this app's
    // scale (one company's Jobs); sorted by Job Code for a findable order.
    const jobs = (await getAllJobs()).sort((a, b) =>
        (a.jobCode || "").localeCompare(b.jobCode || "")
    );

    return (
        <div className="mx-auto w-full max-w-sm p-8">
            <h1 className="text-2xl font-semibold">New Discipline</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created discipline {created}.
                </p>
            )}

            <DisciplineForm jobs={jobs} />
        </div>
    );
}
