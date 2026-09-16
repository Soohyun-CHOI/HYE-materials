// Route-protection helpers built on top of getCurrentUser() (lib/session.js).
// Server Components / Server Actions use requireUser()/requireRole()/
// requireAdmin() directly — they redirect to /login on "not logged in" and
// return { user, authorized } on "logged in but insufficient role/admin",
// leaving the page to decide how to render that (per CLAUDE.md: inline
// message, not a redirect, since the user IS who they say they are — they
// just lack permission).
//
// Route Handlers should NOT use requireUser/requireRole/requireAdmin/
// requirePresident — those redirect (via requireUser) on a missing session,
// and next/navigation's redirect() throws a digest error meant for the
// page-rendering pipeline, not a plain Request/Response function. Route
// Handlers use getActiveUser() (for a public/any-user endpoint) or
// requireAdminApi() (for an Admin endpoint), which return a JSON Response
// instead of redirecting/throwing.
//
// Issue #147: prefer the wrappers at the bottom of this file
// (withAdminApi/withAdminAction/withPresidentAction) over calling the
// helpers directly at a new endpoint. The helpers hand back a decision the
// caller has to act on; the wrappers decide whether the handler runs at all,
// which is what scripts/tests/offline/authz-structure.mjs can actually check.
// Every Admin/President endpoint is expected to be wrapped, and the few that
// aren't are listed as exemptions with reasons in that file. It runs on its
// own with no env, no Airtable and no dev server, and `npm test` runs it on
// every push. (The path said scripts/tests/verify-authz-structure.mjs, which
// #152 moved into the offline tier.)
//
// WHAT THAT CHECK DOES NOT ASK IS WHICH GATE (#196): an export wrapped by the
// wrong one of the three still passes it. For the three PO controls that is
// offline/source-shape.mjs's PO_CONTROL_GATES; the role comparisons the gates
// below make are pinned there too, because nothing behavioral can reach them —
// see requirePresident.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createResponseGuard, createFlagGuard, createThrowingGuard } from "./authzWrap";
import { REQUEST_PATH_HEADER, signInPath } from "./loginDestination";
import { isNameStep, namePath, needsName } from "./userName";
import { getCurrentUser } from "./session";

/**
 * Resolves the session to an active User, or null — like getCurrentUser(),
 * except a Status: Inactive user is also treated as not logged in.
 *
 * Deliberately separate from getCurrentUser(): that function answers "does
 * this session still resolve to a Users record" (and is also used by
 * app/page.js just to display who's signed in, Inactive or not). This
 * answers "is that user allowed to be treated as logged in for
 * authorization purposes" — deactivation (someone who left the company)
 * must take effect immediately against an existing, still-valid session
 * cookie, the same way promotion/demotion does (see lib/session.js).
 */
export async function getActiveUser() {
    const user = await getCurrentUser();
    if (!user || user.status !== "Active") return null;
    return user;
}

/**
 * For Server Components / Server Actions: redirects to /login if there's
 * no active session, otherwise returns the user.
 *
 * AND IT CARRIES WHERE THE READER WAS (#373). This call stands inside the page
 * the reader actually asked for, so it is the only point in the app that knows
 * the address they were trying to reach — after the redirect, `/login` is the
 * address and the original is gone. A scan is what made that expensive: the
 * reader is holding a phone in front of a tool, and the root screen they landed
 * on is the app's only navigation and is drawn for a monitor, so there was no way
 * back to the tool item except scanning the label again.
 *
 * THE ADDRESS COMES OFF A HEADER BECAUSE NEXT OFFERS NOTHING ELSE — see
 * `lib/loginDestination.js`, which records what was looked for and what each
 * candidate was missing. `proxy.js` stamps it; an absent header means the
 * request came by a path the proxy does not match, and `signInPath` then returns
 * the bare `/login`, which is what this function did before this issue.
 *
 * `headers()` IS READ ONLY ON THE WAY OUT, so a call that resolves to a NAMED
 * user costs nothing and marks nothing dynamic that was not already.
 *
 * AND IT ASKS A NAMELESS READER FOR THEIR NAME (#381), which is the second way
 * out of this function. A `Users` row is created with no name — the sign-in is
 * the first moment the address has been proven, so it is the first moment the
 * question can honestly be asked — and every screen that names a person reads
 * that row. The test costs NO Airtable operation: `getActiveUser()` has already
 * fetched the record, so this is a property of an object in hand.
 *
 * THE LOOP IS CLOSED TWICE, both by construction rather than by care. The name
 * step is itself a page and calls this function, so it is excluded by the
 * predicate `lib/userName.js` owns — this file spells no address. And a request
 * the proxy did not stamp carries no address at all, in which case nothing is
 * redirected: an unstampable path must not be able to bounce forever, and a
 * nameless reader seeing one page is a cosmetic cost where a loop is not.
 *
 * ROUTE HANDLERS ARE DELIBERATELY NOT GATED ON THIS. They call `getActiveUser()`
 * or `requireAdminApi()`, neither of which asks, and that is right: a name is a
 * display fact and not an authorization one, so a nameless session may still
 * fetch a file it is entitled to.
 */
export async function requireUser() {
    const user = await getActiveUser();
    if (!user) {
        const headerList = await headers();
        redirect(signInPath(headerList.get(REQUEST_PATH_HEADER)));
    }
    await askForNameIfMissing(user);
    return user;
}

/**
 * Send a signed-in reader with no name to the name step (#381).
 *
 * EXPORTED BECAUSE ONE PAGE CANNOT CALL `requireUser()` AND STILL BE ITSELF.
 * `app/` holds exactly one — the root screen, which renders a signed-OUT state of
 * its own (`Not signed in.` and a way in), so a helper that redirects on a
 * missing session would delete half of what it draws. It resolves the session
 * itself and calls this with the result, which is one implementation of the rule
 * at two call sites rather than two implementations at one each.
 *
 * FOUND IN A BROWSER RATHER THAN REASONED ABOUT. A first sign-in with no
 * destination lands on `DEFAULT_DESTINATION`, which is that page — so the one
 * screen this gate did not reach was the one screen a new colleague sees first,
 * and the walk that created a real account landed there and was asked nothing.
 * `offline/user-name.mjs` enumerates the pages that resolve a session without
 * `requireUser` and requires each to call this, so the next such page fails a
 * check rather than quietly skipping the question.
 *
 * A NULL USER IS A NO-OP, so a caller hands over whatever it resolved without
 * branching first — the signed-out case is the caller's screen to draw.
 */
export async function askForNameIfMissing(user) {
    if (!user || !needsName(user)) return;
    const headerList = await headers();
    const here = headerList.get(REQUEST_PATH_HEADER);
    if (here && !isNameStep(here)) redirect(namePath(here));
}

/**
 * Gates on Role. Accepts a single Role string or an array (e.g.
 * requireRole("President") or requireRole(["President", "Employee"])) —
 * array support from the start avoids a signature change the first time a
 * route needs to allow more than one role.
 *
 * Redirects to /login if not logged in (via requireUser()). Otherwise
 * returns { user, authorized }; the caller renders its own "no permission"
 * UI when authorized is false rather than being redirected away.
 */
async function requireRole(role) {
    const user = await requireUser();
    const roles = Array.isArray(role) ? role : [role];
    return { user, authorized: roles.includes(user.role) };
}

/**
 * Gates on Is Admin. Same shape as requireRole(): redirects to /login if
 * not logged in, otherwise returns { user, authorized }.
 */
export async function requireAdmin() {
    const user = await requireUser();
    return { user, authorized: user.isAdmin === true };
}

/**
 * Server-Action guard for President-only writes (PO signing). Unlike the
 * helpers above it THROWS on the unauthorized case instead of returning
 * { authorized }: its callers (app/pos/[poId]/actions.js — signPOAction,
 * regeneratePDFAction) have no per-branch UI to render, so a thrown error
 * is the intended outcome, and Server Actions are directly callable so the
 * check must live here regardless of what the page renders. Redirects to
 * /login if not logged in (via requireRole -> requireUser).
 *
 * THAT THIS ADMITS ONLY A President — AND NOT AN Admin — IS HELD ON THE AST BY
 * offline/source-shape.mjs (#196), AND THAT IS THE ONLY PLACE IT CAN BE. A
 * credentialed run cannot reach the question: every account on this base that is
 * Admin and not President is unnamed, so requireUser() sends it to /login/name
 * and a forged sign call comes back as the name step rather than as this refusal.
 * The mirror that used to claim it, verify-po-visibility-132.mjs, restated this
 * line as a local ["President"].includes(role) and passed for weeks with its Admin
 * case feeding in "Employee"; it is gone.
 */
async function requirePresident() {
    const { authorized } = await requireRole("President");
    if (!authorized) {
        throw new Error("Only the President can sign a PO.");
    }
}

/**
 * Route-Handler gate for Admin-only endpoints (issue #134). Resolves the
 * session and returns the active Admin user on success, or a NextResponse
 * (401 no session / 403 non-Admin) the handler must return as-is on refusal
 * — the Route-Handler counterpart to requireAdmin(), which can't be used
 * here (it redirects on a missing session). Callers: `const gate = await
 * requireAdminApi(); if (gate instanceof Response) return gate;` — or, inside
 * a Blob upload's onBeforeGenerateToken, throw when it's a Response.
 */
export async function requireAdminApi() {
    const user = await getActiveUser();
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!user.isAdmin) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return user;
}

// --- Guard wrappers (issue #147) -------------------------------------------
//
// The gates above with their decisions already wired in, so an endpoint
// cannot be written in a way that runs its body unauthorized. The factories
// live in lib/authzWrap.js (which imports no next/*, so a verification
// script can import them); these are the bound versions the app uses, and
// binding here is what removes any argument position for the wrong gate.
//
// None of the three passes the resolved user to the handler, because no
// Admin/President call site reads one: every requireAdmin() site destructures
// only { authorized }, and every requireAdminApi() site uses its return value
// only for the `instanceof Response` test. If a wrapped handler ever needs
// the user, add it as a first argument then rather than pre-emptively now.

/**
 * Route Handler, Admin-only:
 *   export const GET = withAdminApi(async (request) => { ... });
 * Refuses with requireAdminApi()'s own 401/403 JSON Response.
 */
export const withAdminApi = createResponseGuard(requireAdminApi);

/**
 * Server Action, Admin-only. The call site supplies its refusal, since this
 * project's actions deliberately differ on that point:
 *   export const a = withAdminAction(() => ({ error: "Not authorized." }), async (prevState, formData) => { ... });
 *   export const b = withAdminAction(() => { throw new Error("Not authorized"); }, async (formData) => { ... });
 */
export const withAdminAction = createFlagGuard(requireAdmin);

/**
 * Server Action, President-only:
 *   export const signPOAction = withPresidentAction(async (prevState, formData) => { ... });
 * requirePresident() throws, so there is no refusal to supply.
 */
export const withPresidentAction = createThrowingGuard(requirePresident);
