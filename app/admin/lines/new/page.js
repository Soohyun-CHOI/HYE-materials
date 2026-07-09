import { requireAdmin } from "@/lib/authz";
import { createLineAction } from "./actions";

export default async function NewLinePage({ searchParams }) {
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
            <h1 className="text-2xl font-semibold">New Line</h1>

            {created && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Created line {created}.
                </p>
            )}

            <form action={createLineAction} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="jobCode" className="block text-sm font-medium">
                        Job Code
                    </label>
                    <input
                        id="jobCode"
                        name="jobCode"
                        required
                        placeholder="e.g. 25-USA-02"
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                    />
                </div>

                <div>
                    <label htmlFor="lineName" className="block text-sm font-medium">
                        Line Name
                    </label>
                    <input
                        id="lineName"
                        name="lineName"
                        required
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full rounded bg-foreground px-3 py-2 text-background"
                >
                    Create Line
                </button>
            </form>
        </div>
    );
}
