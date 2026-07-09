"use client";

import { useActionState } from "react";
import { createLineAction } from "./actions";

export default function LineForm() {
    const [state, formAction, pending] = useActionState(createLineAction, null);

    return (
        <form action={formAction} className="mt-6 space-y-4">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

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
                disabled={pending}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Creating..." : "Create Line"}
            </button>
        </form>
    );
}
