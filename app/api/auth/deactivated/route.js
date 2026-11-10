import { HANDOFF_PARAM } from "@/lib/accountStatus";
import { SIGN_IN_PATH } from "@/lib/loginDestination";
import { endHandedOffSession } from "@/lib/session";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Ends a session whose row a page found turned off, and sends its browser to the sign-in
 * screen, which says why (#491).
 *
 * A PAGE'S GATE FOUND IT, AND A PAGE CANNOT WRITE A COOKIE. `requireUser()` reads the session's
 * row on every page, and Next refuses a cookie write inside a render — so the gate redirects
 * here with a seal of what it found, and this is where the session ends and the screen's notice
 * is written (`lib/accountStatus.js`, `lib/session.js:endHandedOffSession`).
 *
 * IT ACTS ONLY ON THE SESSION THE SEAL NAMES, AND READS NOTHING. The seal is the page's finding,
 * made with the session's secret a moment ago; this ends the browser's session and leaves the
 * notice only when the seal opens and names the user that session is. A seal that does not open
 * — altered, forged, or over a minute old — and one carried to a browser holding another session
 * or none change nothing, and land on the sign-in screen as anybody would. So the address cannot
 * be used to sign somebody out or to show them the sentence.
 *
 * A GET, BECAUSE THE BROWSER FOLLOWS A PAGE'S REDIRECT HERE. That makes it no login-CSRF
 * surface: it can only end a session, and only the one a seal from this server names.
 *
 * A RELATIVE `Location`, so the browser goes back to `/login` on the host it asked — the one
 * whose cookies this response just set. `request.url` names `localhost` under `next dev`
 * whatever host was used (`docs/notes/authorization.md`), which would land a walk on another
 * host's cookies; deployed, the two are the same.
 */
export async function GET(request) {
    return withOpsLabel("GET /api/auth/deactivated", async () => {
        await endHandedOffSession(new URL(request.url).searchParams.get(HANDOFF_PARAM));
        return new Response(null, { status: 303, headers: { Location: SIGN_IN_PATH } });
    });
}
