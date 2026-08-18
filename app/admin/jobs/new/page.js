import { requireAdmin } from "@/lib/authz";
import { createJobAction } from "./actions";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "New Job" };

// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function NewJobPage(props) {
    return withOpsLabel("/admin/jobs/new", () => renderNewJobPage(props));
}

async function renderNewJobPage({ searchParams }) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is Admin-only.</p>
            </div>
        );
    }

    const { created } = await searchParams;

    return (
        <div className="mx-auto w-full max-w-sm p-8">
            <h1 className="text-2xl font-semibold">New Job</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created job {created}.
                </p>
            )}

            <form action={createJobAction} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="jobCode" className="block text-sm font-medium">
                        Job Code
                    </label>
                    <input
                        id="jobCode"
                        name="jobCode"
                        required
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="jobName" className="block text-sm font-medium">
                        Job Name
                    </label>
                    <input
                        id="jobName"
                        name="jobName"
                        required
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="businessUnit" className="block text-sm font-medium">
                        Business Unit
                    </label>
                    <select
                        id="businessUnit"
                        name="businessUnit"
                        required
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    >
                        <option value="EPC">EPC</option>
                        <option value="HT">HT</option>
                        <option value="SYS">SYS</option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="w-full rounded bg-foreground px-3 py-2 text-background"
                >
                    Create Job
                </button>
            </form>
        </div>
    );
}
