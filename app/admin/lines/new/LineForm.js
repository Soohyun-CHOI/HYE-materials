"use client";

import { useActionState } from "react";
import { createLineAction } from "./actions";

export default function LineForm({ jobs }) {
    const [state, formAction, pending] = useActionState(createLineAction, null);

    return (
        <form action={formAction} className="mt-6 space-y-4">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            {/* Issue #30 — pick from existing Jobs instead of free-typing a
                Job Code, so a Line can never be attached to a nonexistent (or,
                worse, a wrong-but-real) Job by a typo. Native select mirrors
                PRForm's Job picker; the value submitted is the Job's record id,
                which createLineAction re-verifies server-side. */}
            <div>
                <label htmlFor="jobId" className="block text-sm font-medium">
                    Job
                </label>
                <select
                    id="jobId"
                    name="jobId"
                    required
                    defaultValue=""
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                >
                    <option value="" disabled>
                        Select a Job
                    </option>
                    {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                            {j.jobCode} — {j.jobName}
                        </option>
                    ))}
                </select>
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
                disabled={pending}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Creating..." : "Create Line"}
            </button>
        </form>
    );
}
