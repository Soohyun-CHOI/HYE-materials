import { NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth";
import { CROSS_ORIGIN_REFUSAL, isCrossOrigin } from "@/lib/crossOrigin";
import {
    confirmPath,
    DEFAULT_DESTINATION,
    DESTINATION_PARAM,
    safeDestination,
} from "@/lib/loginDestination";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Consumes a magic-link token and starts the session (#203).
 *
 * POST, NOT GET, AND THAT IS THE WHOLE ISSUE. Mail security scanners open links
 * in delivered messages before the recipient does, so a `GET` that consumed the
 * single-use token spent it on the scanner's behalf and left the recipient with
 * the invalid-or-expired error. The link now points at `/login/confirm`, which
 * reads the token without spending it; this endpoint is reached only from that
 * page's form.
 *
 * Reached by a plain HTML form, so the body is form-encoded rather than JSON and
 * every response is a redirect a browser can follow with no script involved.
 *
 * IT IS ALSO THE ONE PLACE A DESTINATION TURNS INTO A REDIRECT (#373), which is
 * what makes `safeDestination` below the call that actually protects anything:
 * this endpoint is reachable without the page that renders the form, so a value
 * judged only there would be judged nowhere. A value it refuses lands on
 * `DEFAULT_DESTINATION`, exactly as a submission carrying none does.
 *
 * IT REFUSES A CROSS-ORIGIN SUBMISSION FIRST, because the token authenticates the
 * request and not the submitter's intent — login CSRF. The predicate and its
 * reasoning are `lib/crossOrigin.js` since #471, which gave the same refusal to
 * the code a sign-in email carries; nothing about this route's behavior moved
 * with it.
 */
export async function POST(request) {
    return withOpsLabel("POST /api/auth/verify", async () => {
        if (isCrossOrigin(request)) {
            return NextResponse.json({ error: CROSS_ORIGIN_REFUSAL }, { status: 403 });
        }

        const form = await request.formData();
        const token = form.get("token");
        const destination = safeDestination(form.get(DESTINATION_PARAM));

        // 303, not the 307 NextResponse.redirect defaults to: 307 preserves the
        // method, which would re-POST to the destination. 303 is what turns a POST
        // into the GET a browser should land on.
        const seeOther = (path) => NextResponse.redirect(new URL(path, request.url), 303);

        // Every refusal goes back to the confirmation page carrying the same token,
        // so the page re-reads the row and names the actual reason — already used,
        // expired, or never valid. A second POST of a consumed token therefore lands
        // on "already used" rather than on a generic error, and so does the back
        // button after a successful sign-in. Since #373 each refusal carries the
        // destination back as well, so a reader who has to request another link
        // does not lose where they were going.
        if (typeof token !== "string" || !token) {
            return seeOther(confirmPath({ destination }));
        }

        try {
            await verifyMagicLink(token);
        } catch {
            return seeOther(confirmPath({ token, destination }));
        }

        return seeOther(destination ?? DEFAULT_DESTINATION);
    });
}
