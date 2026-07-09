"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES = {
    missing_token: "That sign-in link is missing its token.",
    invalid_token: "That sign-in link is invalid or has expired. Request a new one below.",
};

function LoginForm() {
    const searchParams = useSearchParams();
    const linkError = ERROR_MESSAGES[searchParams.get("error")] || null;

    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle | submitting | sent | error
    const [errorMessage, setErrorMessage] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        if (status === "submitting") return; // double-click / double-submit guard

        setStatus("submitting");
        setErrorMessage("");

        try {
            const res = await fetch("/api/auth/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Something went wrong");
            }

            setStatus("sent");
        } catch (err) {
            setStatus("error");
            setErrorMessage(err.message);
        }
    }

    if (status === "sent") {
        return (
            <div className="w-full max-w-sm text-center">
                <h1 className="text-2xl font-semibold">Check your email</h1>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    We sent a sign-in link to {email}. It expires in 15 minutes.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div>
                <h1 className="text-2xl font-semibold">Sign in</h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Use your company email address.
                </p>
            </div>

            {linkError && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {linkError}
                </p>
            )}

            <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={status === "submitting"}
                className="w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-black"
            />

            {status === "error" && (
                <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {status === "submitting" ? "Sending..." : "Send sign-in link"}
            </button>
        </form>
    );
}

export default function LoginPage() {
    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <Suspense fallback={null}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
