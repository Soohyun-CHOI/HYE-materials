/**
 * Whether a submission came from another site — the login-CSRF refusal every
 * sign-in POST makes (#471).
 *
 * IT LIVED INSIDE `app/api/auth/verify/route.js` UNTIL #471 GAVE IT TWO MORE
 * CALLERS. The code a sign-in email carries is spent by `POST /api/auth/code`,
 * and the request that sends the email now seals which request this browser is
 * waiting on, so `POST /api/auth/request` changes a browser's cookies too. Three
 * copies of one comparison would be the duplication CLAUDE.md's "One rule, one
 * implementation" is about, and a route file cannot export a helper — Next accepts
 * only its own names there — so the rule moved here rather than to a sibling.
 *
 * THE THREAT IS LOGIN CSRF, WHICH NEITHER THE TOKEN NOR THE CODE ANSWERS. Each
 * authenticates a request but not the submitter's intent, so an attacker can
 * submit their OWN token, or their own code, through a victim's browser and land
 * the victim in the attacker's account. That is not merely a mislabeled session
 * here: this app's signing chain rests on who submitted a purchase request, so a
 * victim authoring under someone else's identity corrupts the record the app
 * exists to keep. `sameSite: "lax"` on the session cookie does not help — it
 * governs a cookie being SENT, not being SET, and these responses set one.
 *
 * FAIL OPEN WHEN `Origin` IS ABSENT. Every current browser sends it on a POST, so a
 * real submission is covered; refusing on absence would instead break any client
 * that omits it, for no gain against an attacker who can send any header they like
 * anyway. The header is compared against `Host` rather than against `request.url`,
 * because behind Vercel's proxy `Host` is the public host the request was actually
 * addressed to.
 *
 * A MALFORMED `Origin` IS A REJECTION, not a parse error to shrug at: it is
 * present, so the fail-open case does not apply, and it does not match.
 *
 * Pure: it reads two headers and parses one URL, so `offline/sign-in-code.mjs`
 * calls it with plain header objects.
 */
export function isCrossOrigin(request) {
    const origin = request.headers.get("origin");
    if (!origin) return false;

    const host = request.headers.get("host");
    try {
        return new URL(origin).host !== host;
    } catch {
        return true;
    }
}

/** What a refused submission is told. One sentence for every sign-in POST. */
export const CROSS_ORIGIN_REFUSAL = "Cross-origin sign-in is not allowed";
