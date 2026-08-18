import { requireAdmin } from "@/lib/authz";
import { createVendorAction } from "./actions";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "New Vendor" };

// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function NewVendorPage(props) {
    return withOpsLabel("/admin/vendors/new", () => renderNewVendorPage(props));
}

async function renderNewVendorPage({ searchParams }) {
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
            <h1 className="text-2xl font-semibold">New Vendor</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created vendor {created}.
                </p>
            )}

            <form action={createVendorAction} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="vendorName" className="block text-sm font-medium">
                        Vendor Name
                    </label>
                    <input
                        id="vendorName"
                        name="vendorName"
                        required
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="picName" className="block text-sm font-medium">
                        PIC Name
                    </label>
                    <input
                        id="picName"
                        name="picName"
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="picPhone" className="block text-sm font-medium">
                        PIC Phone
                    </label>
                    <input
                        id="picPhone"
                        name="picPhone"
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label htmlFor="picEmail" className="block text-sm font-medium">
                        PIC Email
                    </label>
                    <input
                        id="picEmail"
                        name="picEmail"
                        type="email"
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full rounded bg-foreground px-3 py-2 text-background"
                >
                    Create Vendor
                </button>
            </form>
        </div>
    );
}
