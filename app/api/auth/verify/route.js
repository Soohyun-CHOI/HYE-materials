import { NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth";
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
 */

const CONFIRM_PATH = "/login/confirm";

/**
 * Reject a cross-origin submission.
 *
 * THE THREAT IS LOGIN CSRF, WHICH THE TOKEN DOES NOT ANSWER. The token
 * authenticates the request but not the submitter's intent, so an attacker can
 * POST their OWN token through a victim's browser and land the victim in the
 * attacker's account. That is not merely a mislabeled session here: this app's
 * signing chain rests on who submitted a purchase request, so a victim authoring
 * under someone else's identity corrupts the record the app exists to keep.
 * `sameSite: "lax"` on the session cookie does not help — it governs a cookie
 * being SENT, not being SET, and this response sets one.
 *
 * FAIL OPEN WHEN `Origin` IS ABSENT. Every current browser sends it on a form
 * POST, so a real submission is covered; refusing on absence would instead break
 * any client that omits it, for no gain against an attacker who can send any
 * header they like anyway. The header is compared against `Host` rather than
 * against `request.url`, because behind Vercel's proxy `Host` is the public host
 * the request was actually addressed to.
 *
 * A MALFORMED `Origin` IS A REJECTION, not a parse error to shrug at: it is
 * present, so the fail-open case does not apply, and it does not match.
 */
function isCrossOrigin(request) {
    const origin = request.headers.get("origin");
    if (!origin) return false;

    const host = request.headers.get("host");
    try {
        return new URL(origin).host !== host;
    } catch {
        return true;
    }
}

export async function POST(request) {
    return withOpsLabel("POST /api/auth/verify", async () => {
        if (isCrossOrigin(request)) {
            return NextResponse.json({ error: "Cross-origin sign-in is not allowed" }, { status: 403 });
        }

        const form = await request.formData();
        const token = form.get("token");

        // 303, not the 307 NextResponse.redirect defaults to: 307 preserves the
        // method, which would re-POST to the destination. 303 is what turns a POST
        // into the GET a browser should land on.
        const seeOther = (path) => NextResponse.redirect(new URL(path, request.url), 303);

        // Every refusal goes back to the confirmation page carrying the same token,
        // so the page re-reads the row and names the actual reason — already used,
        // expired, or never valid. A second POST of a consumed token therefore lands
        // on "already used" rather than on a generic error, and so does the back
        // button after a successful sign-in.
        if (typeof token !== "string" || !token) {
            return seeOther(CONFIRM_PATH);
        }

        try {
            await verifyMagicLink(token);
        } catch {
            return seeOther(`${CONFIRM_PATH}?token=${encodeURIComponent(token)}`);
        }

        return seeOther("/");
    });
}
