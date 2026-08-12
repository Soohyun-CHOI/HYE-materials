import Link from "next/link";
import { getAuthTokenRecord } from "@/lib/airtable/authTokens";
import { CONFIRM_COPY, describeToken, REQUEST_NEW_LINK, TOKEN_STATES } from "@/lib/authTokenState";
import { SIGN_IN_TITLE } from "@/lib/productName";
import { withOpsLabel } from "@/lib/airtableOps";

export const metadata = { title: "Confirm sign-in" };

// Never cached, never prerendered. The answer depends entirely on one row's
// current state, and a cached "this link is valid" would outlive the click that
// made it false.
export const dynamic = "force-dynamic";

export default async function ConfirmSignInPage(props) {
    return withOpsLabel("/login/confirm", () => renderConfirmSignInPage(props));
}

/**
 * Where the magic link now lands (#203).
 *
 * THIS PAGE READS THE TOKEN AND MUST NEVER CONSUME IT. That is the entire
 * issue: mail security scanners open links in delivered messages before the
 * recipient does, so while `/api/auth/verify` spent the token on `GET`, the
 * scanner spent it and the recipient got the invalid-or-expired error. Observed
 * with a real recipient, well inside the 15-minute window. So the only Airtable
 * call here is `getAuthTokenRecord`, which is a `select` and nothing else, and
 * `offline/source-shape.mjs` asserts that neither `consumeAuthToken` nor
 * `verifyMagicLink` is named in this file — the property is easy to undo by
 * someone reasonably thinking the extra step is redundant.
 *
 * Consuming happens on the form POST below, which a scanner does not issue.
 *
 * THE TARGET ADDRESS IS SHOWN, which withholds nothing: anyone who can read
 * this page already holds the token and can press the button to become that
 * user, so hiding the address only hides it from the person being asked to
 * press. Showing it is what makes a login-CSRF attempt visible to its victim —
 * being asked to sign in as somebody else is the one thing that reads as wrong.
 * It is also useful on its own, since one person can hold two addresses here.
 */
async function renderConfirmSignInPage({ searchParams }) {
    const { token } = await searchParams;
    const record = typeof token === "string" && token ? await getAuthTokenRecord(token) : null;

    const state = describeToken({
        token,
        exists: Boolean(record),
        used: record?.get("Used") === true,
        expiresAt: record?.get("Expires At"),
    });
    const copy = CONFIRM_COPY[state];
    const email = record?.get("Email");

    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-semibold">{SIGN_IN_TITLE}</h1>

                {state === TOKEN_STATES.VALID ? (
                    <>
                        <p className="mt-2 text-zinc-600">
                            Signing in as <strong className="font-medium">{email}</strong>.
                        </p>
                        <p className="mt-1 text-zinc-600">{copy.body}</p>

                        {/* A plain HTML form, deliberately: no client component, no
                            action id, no script of any kind, so it still works where
                            scripts are blocked. It is also what makes the behavior
                            reproducible with one request in a check. */}
                        <form method="POST" action="/api/auth/verify" className="mt-6">
                            <input type="hidden" name="token" value={token} />
                            <button
                                type="submit"
                                className="w-full rounded bg-foreground px-3 py-2 text-background"
                            >
                                {copy.action}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <p className="mt-2 text-zinc-600">{copy.body}</p>
                        <Link href="/login" className="mt-6 inline-block text-sm underline">
                            {REQUEST_NEW_LINK}
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
