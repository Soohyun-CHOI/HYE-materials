"use client";

import { useActionState, useState } from "react";
import { createDisciplineAction } from "./actions";
import JobCombobox from "./JobCombobox";

export default function DisciplineForm({ jobs }) {
    const [state, formAction, pending] = useActionState(createDisciplineAction, null);
    // Issue #30 (follow-up) — the combobox has no native `required`, so track
    // the picked Job here to gate submit until one is chosen (the server also
    // rejects an empty/forged jobId; this is the client-side half).
    const [jobId, setJobId] = useState("");

    return (
        <form action={formAction} className="mt-6 space-y-4">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            {/* Issue #30 — pick from existing Jobs instead of free-typing a
                Job Code, so a Discipline can never be attached to a nonexistent
                (or, worse, a wrong-but-real) Job by a typo. Searchable combobox
                (JobCombobox) submits the chosen Job's record id, which
                createDisciplineAction re-verifies server-side. */}
            <div>
                <label htmlFor="jobId" className="block text-sm font-medium">
                    Job
                </label>
                <JobCombobox jobs={jobs} value={jobId} onChange={setJobId} />
            </div>

            <div>
                <label htmlFor="disciplineName" className="block text-sm font-medium">
                    Discipline Name
                </label>
                <input
                    id="disciplineName"
                    name="disciplineName"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>

            <button
                type="submit"
                disabled={pending || !jobId}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Creating..." : "Create Discipline"}
            </button>
        </form>
    );
}
