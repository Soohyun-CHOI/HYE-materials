"use client";

import { useState } from "react";
import { SIGN_IN_TITLE } from "@/lib/productName";
import { TOKEN_TTL_MINUTES } from "@/lib/authTokenState";

// The `?error=` messages that used to live here are gone (#203). Their only two
// producers were the redirects in app/api/auth/verify/route.js, and both went
// when that route stopped answering GET — a refused sign-in now returns to
// /login/confirm, which re-reads the row and names the actual reason. With no
// producer left, the messages could not be reached, and neither could the
// `useSearchParams` call that read them or the Suspense boundary that call
// required.
function LoginForm() {
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
                    We sent a sign-in link to {email}. Open it and press Confirm
                    sign-in. It expires in {TOKEN_TTL_MINUTES} minutes.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <div>
                {/* The same line the magic-link email's subject carries, from
                    the same constant (#201) — this is the screen that email
                    lands on, so reading the sentence it was sent under is what
                    says the link arrived where it claimed, and distinguishes
                    this app from the group's other portals. */}
                <h1 className="text-2xl font-semibold">{SIGN_IN_TITLE}</h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Use your company email address.
                </p>
            </div>

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
            <LoginForm />
        </div>
    );
}
