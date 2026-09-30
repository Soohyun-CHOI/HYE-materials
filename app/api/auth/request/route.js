import { NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth";
import { CROSS_ORIGIN_REFUSAL, isCrossOrigin } from "@/lib/crossOrigin";
import { clearPendingSignIn } from "@/lib/session";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Asks for a sign-in email, and binds this browser to it (#471).
 *
 * IT REFUSES A CROSS-ORIGIN SUBMISSION SINCE #471, WHICH GAVE IT A COOKIE TO SET.
 * Until then this route only sent mail, which anybody may ask for. It now also
 * seals which email this browser is waiting on, so a page elsewhere posting here
 * through a visitor's browser could leave that browser waiting on the page
 * author's own email — the first half of the login CSRF `lib/crossOrigin.js`
 * describes. The code route refuses the second half; refusing both is what keeps
 * one of them from being the only line.
 *
 * THE ANSWER SAYS NOTHING ABOUT THE ADDRESS. It is the same `{ ok: true }` for
 * every company address, since the row is made whether or not anybody has signed
 * in with it — which is what keeps this route from telling a caller who has an
 * account. It carries neither the token nor the code, and nor does the cookie.
 */
export async function POST(request) {
    return withOpsLabel("POST /api/auth/request", async () => {
        if (isCrossOrigin(request)) {
            return NextResponse.json({ error: CROSS_ORIGIN_REFUSAL }, { status: 403 });
        }

        const { email, destination } = await request.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const baseUrl = new URL(request.url).origin;

        // The destination is passed on unjudged and judged where the link is
        // built (#373): `confirmPath` calls the predicate itself, so no caller
        // of it — this one included — can put an unjudged value into a URL.
        try {
            await requestMagicLink(email, { baseUrl, destination });
        } catch (err) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    });
}

/**
 * Forgets which email this browser is waiting on — the code step's
 * `Use a different email` (#471). The binding outlives a reload by design, so the
 * screen draws the code step again after one; without this there would be no way
 * back to the address short of waiting out the fifteen minutes. Having nothing to
 * forget is not an error, and the email already sent is left as it is.
 */
export async function DELETE(request) {
    return withOpsLabel("DELETE /api/auth/request", async () => {
        if (isCrossOrigin(request)) {
            return NextResponse.json({ error: CROSS_ORIGIN_REFUSAL }, { status: 403 });
        }

        await clearPendingSignIn();
        return NextResponse.json({ ok: true });
    });
}
