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
// which is what scripts/tests/verify-authz-structure.mjs can actually check.
// Every Admin/President endpoint is expected to be wrapped, and the few that
// aren't are listed as exemptions with reasons in that file. It runs on its
// own with no env, no Airtable and no dev server — run it after adding an
// endpoint.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createResponseGuard, createFlagGuard, createThrowingGuard } from "./authzWrap";
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
 */
export async function requireUser() {
    const user = await getActiveUser();
    if (!user) redirect("/login");
    return user;
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
export async function requireRole(role) {
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
 */
export async function requirePresident() {
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
