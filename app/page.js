import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { withOpsLabel } from "@/lib/airtableOps";

// Labeled for #190 — see the note in app/prs/page.js for why the label is an
// outer wrapper. This page is measured because it is the dev loop's entry point
// and is loaded constantly, not because it is expensive.
export default async function Home() {
    return withOpsLabel("/", () => renderHome());
}

async function renderHome() {
    const user = await getCurrentUser();

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-8">
            {user ? (
                <>
                    <p className="text-lg">
                        Signed in as <strong>{user.email}</strong> ({user.role}
                        {user.isAdmin ? ", Admin" : ""})
                    </p>
                    <Link
                        href="/prs/new"
                        className="rounded bg-foreground px-4 py-2 text-background"
                    >
                        New Purchase Request
                    </Link>
                    {/* Issue #19 — the app has no navigation shell, so a new
                        route is otherwise reachable only by typing the URL.
                        One link here rather than inventing a nav bar, which is
                        a separate decision. */}
                    <Link
                        href="/materials"
                        className="rounded border border-zinc-300 px-4 py-2"
                    >
                        Material prices
                    </Link>
                    {/* Issue #162 — same reasoning as the link above. */}
                    <Link
                        href="/deliveries"
                        className="rounded border border-zinc-300 px-4 py-2"
                    >
                        Deliveries
                    </Link>
                    {/* Issue #168 — same reasoning again. Before this, a purchase
                        order was reachable only through the PR that generated it. */}
                    <Link
                        href="/pos"
                        className="rounded border border-zinc-300 px-4 py-2"
                    >
                        Purchase orders
                    </Link>
                    <form action="/api/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="rounded border border-zinc-300 px-4 py-2"
                        >
                            Sign out
                        </button>
                    </form>
                </>
            ) : (
                <>
                    <p className="text-lg">Not signed in.</p>
                    <Link
                        href="/login"
                        className="rounded bg-foreground px-4 py-2 text-background"
                    >
                        Sign in
                    </Link>
                </>
            )}
        </div>
    );
}
