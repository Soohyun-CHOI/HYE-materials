import { NextResponse } from "next/server";
import { REQUEST_PATH_HEADER } from "@/lib/loginDestination";

/**
 * Stamps the address a request was made to onto the request itself (#373).
 *
 * **THIS IS NOT A GATE, IT NEVER BECOMES ONE, AND THAT SENTENCE IS THE REASON
 * THIS COMMENT IS LONGER THAN THE CODE.** Authorization in this app is each
 * page's own `requireUser()` call, and #46 refused a `proxy.js` deliberately
 * rather than never getting round to one. Its argument, which still holds: the
 * session cookie carries `{ userId }` and nothing else — Role, Is Admin and
 * Status are deliberately not cached in it, so deactivation and demotion take
 * effect against a live session — which leaves a proxy able to ask only whether
 * a cookie exists, and that saves a page nothing. **It also left a revisit
 * condition — "enough protected pages that a first-line must-be-logged-in gate
 * becomes worth the added layer" — and a reader finding this file will
 * reasonably think that condition fired. It did not.** This file exists because
 * the framework gives a Server Component no way to learn its own address, and
 * for nothing else.
 *
 * **THE CONDITION SHOULD NOT FIRE HERE EVEN WHEN SOMEBODY DECIDES IT HAS**, and
 * the reason is stronger than the cookie one: this app's real authorization is
 * per RECORD. `canViewPR` admits a reader who raised the request, or is assigned
 * to its job, or is on its signing chain — none of which is knowable without
 * reading the record, which a proxy must not do (it runs on every request,
 * prefetches included). So a gate here could only ever be the weakest question
 * the app asks, in front of the page that already asks it, and its real effect
 * would be to make a page whose own `requireUser()` was dropped look covered.
 * Put an authorization question in the page, in the Server Action, or in the
 * Route Handler — `lib/authz.js` has the helper for each.
 *
 * WHAT IT MAY TOUCH, THEREFORE: the request headers, and nothing else. It reads
 * no session, no cookie and no record, makes no Airtable call and imports
 * nothing that could — `offline/login-destination.mjs` asserts all of that on
 * this file's own AST, so the paragraphs above are enforced rather than trusted.
 *
 * It SETS rather than appends, so a header of this name arriving from a client
 * is replaced rather than joined; `lib/loginDestination.js` carries what that
 * would be worth to a client anyway, which is nothing.
 *
 * THE RUNTIME IS NOT DECLARED BECAUSE IT CANNOT BE. Next 16 renamed
 * `middleware.js` to `proxy.js` and a proxy always runs on Node — a route
 * segment config naming a runtime here is a build error, measured against
 * 16.2.10 rather than read off a changelog.
 */
export function proxy(request) {
    const headers = new Headers(request.headers);
    // The search string is part of the address the reader asked for: a filtered
    // list is not the same page as the bare one, and returning them to the bare
    // one after a sign-in would lose what they had narrowed to.
    headers.set(REQUEST_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers } });
}

/**
 * Everything that can be a screen, and nothing that cannot.
 *
 * `/api` IS EXCLUDED ON A FACT RATHER THAN TO SAVE A HOP. A Route Handler cannot
 * call `requireUser()` at all — `redirect()` throws a digest meant for the page
 * pipeline — so nothing under `/api` can produce a destination, and stamping
 * there would pay an invocation per file download for a header nothing reads.
 * The check holds that fact from the other side: no Route Handler under
 * `app/api` calls `requireUser`, so the day one does, this exclusion is
 * re-opened by a failure rather than by somebody noticing.
 *
 * A Server Action POSTs to its own page's URL rather than to `/api`, so the
 * actions are inside this matcher and a signed-out submission is returned to the
 * page it was made from.
 */
export const config = {
    matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
