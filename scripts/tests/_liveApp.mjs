// Reaching the RUNNING app from a script (#250) — a session, a Server Action's
// id, and the call that invokes it.
//
// WHY IT EXISTS. #382 measured all three against `deleteInvoiceAction` and left
// them inline, which was right for one caller and wrong for two: #250 needs the
// same three against `withdrawAction`, and a second copy of a lookup into
// Turbopack's internals is exactly the "one rule, one implementation" case
// CLAUDE.md is about. So the machinery moved here and 382 imports it.
//
// WHAT IT DOES NOT OWN YET, WITH THE CONDITION FOR FINISHING IT. Ten scripts in
// this tier mint a session with their own copy of `sessionCookieFor`, in two
// variants. Two of them — this module's callers — use this one; the other nine
// still carry their own, because unifying them means re-running nine credentialed
// scripts to prove each still works, which is a change of its own rather than a
// side effect of this one. `docs/notes/backlog.md` holds which variant is right
// and why the wrong one is not urgent.
//
// ── THE THREE PIECES, AND WHAT EACH WAS MEASURED AGAINST ────────────────────
//
// A SESSION. `createAuthToken` then a form POST to `/api/auth/verify`, which is
// the only route in the app that issues one — the email step is skipped because
// nothing here can read a delivered inbox. **The cookie's ATTRIBUTES are dropped,
// which is the variant #382 did not use**: `getSetCookie()` returns
// `name=value; Path=/; HttpOnly; …`, and joining those whole sends `Path` and
// `HttpOnly` back as if they were cookies of their own. It works either way —
// `iron-session` looks its own name up rather than reading the header
// positionally — so this is correctness rather than a fix for a symptom.
//
// AN ACTION'S ID. Turbopack writes `__next_internal_action_entry_do_not_use__`
// into the client chunk that carries the client reference, and it is a JSON map
// of id to export NAME — so the lookup asks for a name and assumes no ordering.
// Read from the served chunks rather than from a manifest because a dev server
// and a built server do not agree on the id (#231 measured that they differ).
// Returns null rather than guessing: a production build may not carry the
// marker, and a caller must report that as incomplete rather than skip silently.
//
// THE CALL. `POST` to a page's own URL with the id in a `Next-Action` header.
// **The body has two shapes and which one applies is decided by the arguments,
// not by the caller**, because React's own encoder decides it that way:
//
//   - Every argument JSON-serializable -> `content-type: text/plain;charset=UTF-8`
//     and the argument array as JSON. This is #382's shape, and the only one it
//     needed: `deleteInvoiceAction(invoiceId)` takes one string.
//   - Any argument a `FormData` -> multipart, which #250 is the first to need.
//     `withdrawAction(prevState, formData)` is the `useActionState` signature, so
//     the second argument is a FormData and no JSON body can carry it.
//
// THE MULTIPART SHAPE IS READ OFF REACT'S OWN ENCODER rather than guessed —
// `next/dist/compiled/react-server-dom-turbopack/cjs/…-client.browser.development.js`,
// `processReply`. A FormData argument becomes `"$K" + partId.toString(16)` in the
// model and its entries are appended under `formFieldPrefix + "_" + partId + "_"`;
// `encodeReply` calls `processReply` with an empty prefix and finally sets the
// model under `"0"`. So `[null, {prId}]` is exactly:
//
//     "_1_prId" = <the value>          (parts first, as the encoder emits them)
//     "0"       = [null,"$K1"]
//
// and the server takes it at `action-handler.js`'s `isMultipartAction &&
// isFetchAction` branch, through `decodeReplyFromBusboy`. Parts are written
// before the model because that is the order a browser sends and busboy is a
// stream; nothing here depends on it beyond matching what was measured.
//
// READING THE ANSWER. `callServerAction` hands back the raw flight text plus two
// things read out of it, and **neither is a verdict**. A refusal is the action's
// OWN `{"error":"…"}`; the route tree carries `"error":"$undefined"` on every
// response, so a bare search for `"error"` reads a success as a failure — that is
// what #382's first run did. What a caller should conclude from is the base.
//
// Offline-safe: no. `lib/airtable/authTokens.js` reaches the Airtable client, so
// this module is credentialed-tier only.

import { createAuthToken } from "../../lib/airtable/authTokens.js";

/** Where the dev server is, unless a caller says otherwise. */
export const DEFAULT_BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * A session cookie for one address, minted and spent the way the app issues one.
 *
 * Costs one `Auth Tokens` row, which is left on the base — every script in this
 * tier does, and the row is single-use and expired within fifteen minutes.
 *
 * Throws rather than returning "" so a caller cannot carry an empty cookie into
 * assertions that would then measure a signed-out reader.
 */
export async function sessionCookieFor(email, { baseUrl = DEFAULT_BASE_URL } = {}) {
    const { token } = await createAuthToken(email);
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
    });
    const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    if (!cookie) {
        throw new Error(`no session cookie from /api/auth/verify for ${email} (status ${res.status})`);
    }
    return cookie;
}

/**
 * The id of a Server Action a CLIENT component imports, looked up by export name.
 *
 * The page must be one that RENDERS the component importing the action — the
 * script tags are what this walks, and a component behind a false condition puts
 * no chunk on the page.
 */
export async function serverActionId(pageUrl, exportName, { cookie, baseUrl = DEFAULT_BASE_URL } = {}) {
    const html = await (await fetch(pageUrl, { headers: { cookie } })).text();
    const scripts = [...new Set([...html.matchAll(/src="(\/_next\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
    for (const src of scripts) {
        const js = await (await fetch(`${baseUrl}${src}`, { headers: { cookie } })).text();
        for (const m of js.matchAll(/__next_internal_action_entry_do_not_use__\s*(\[.*?\])\s*\*\//gs)) {
            let parsed;
            try {
                parsed = JSON.parse(m[1]);
            } catch {
                continue;
            }
            for (const [id, meta] of Object.entries(parsed[0] || {})) {
                if (meta?.name === exportName) return id;
            }
        }
    }
    return null;
}

/**
 * React's reply encoding of an argument array, for the subset this tier sends.
 *
 * Returns a string for arguments React would serialize as plain JSON, and a
 * FormData once one of them is a FormData. Anything else React supports —
 * streams, Blobs, Maps, temporary references — is deliberately absent: a script
 * needing one should extend this against the encoder rather than hand-roll a
 * second body beside it.
 */
function encodeArguments(args) {
    let partId = 1;
    let parts = null;
    const model = JSON.stringify(args, (_key, value) => {
        if (value instanceof FormData) {
            parts ??= new FormData();
            const id = partId++;
            for (const [name, entry] of value.entries()) parts.append(`_${id}_${name}`, entry);
            return `$K${id.toString(16)}`;
        }
        return value;
    });
    if (parts === null) return model;
    parts.set("0", model);
    return parts;
}

/**
 * Invoke a Server Action over the RPC a browser with JavaScript uses.
 *
 * `pageUrl` is which page re-renders afterwards, not which action runs — the id
 * decides that, and it is global to the app. Post to the page the control lives
 * on, so what a caller exercises is what a reader would.
 *
 * Returns `{ status, flight, redirect, refusal }`. `refusal` is the action's own
 * error string or null; `redirect` is where a `redirect()` sent the caller, read
 * from the header Next sets for a fetch action.
 */
export async function callServerAction({ pageUrl, actionId, args, cookie }) {
    const body = encodeArguments(args);
    const res = await fetch(pageUrl, {
        method: "POST",
        redirect: "manual",
        headers: {
            cookie,
            "Next-Action": actionId,
            // A string body needs the content type React sends with one; a
            // FormData body must have none, so fetch writes its own boundary.
            ...(typeof body === "string" ? { "content-type": "text/plain;charset=UTF-8" } : {}),
        },
        body,
    });
    const flight = await res.text();
    const refusal = flight.match(/"error":"(?!\$undefined)((?:[^"\\]|\\.)*)"/);
    return {
        status: res.status,
        flight,
        redirect: res.headers.get("x-action-redirect") || res.headers.get("location") || null,
        refusal: refusal ? JSON.parse(`"${refusal[1]}"`) : null,
    };
}
