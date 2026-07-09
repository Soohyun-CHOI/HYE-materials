import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
    const user = await getCurrentUser();

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-8 dark:bg-black">
            {user ? (
                <>
                    <p className="text-lg">
                        Signed in as <strong>{user.email}</strong> ({user.role}
                        {user.isAdmin ? ", Admin" : ""})
                    </p>
                    <form action="/api/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
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
