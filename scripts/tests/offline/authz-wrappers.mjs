// The guard wrappers' control flow — a refused gate must not run the handler.
//
// Extracted by #152 from verify-authz.mjs Part D. Same story as pr-visibility:
// it was already offline (lib/authzWrap.js imports nothing at all — that is why
// #147 put the factories there) but it lived in a file that imports Airtable,
// so it could only be reached with credentials.
//
// This is the one property the structural check cannot see. authz-structure.mjs
// proves each endpoint export IS wrapped; only calling a wrapper with a
// refusing gate proves that being wrapped stops the body. The factories are the
// production ones; only the gate is injected, which is the seam #147 added for
// exactly this and which the bound wrappers in lib/authz.js do not expose.

import { createResponseGuard, createFlagGuard, createThrowingGuard } from "../../../lib/authzWrap.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Guard wrappers — a refused gate must not run the handler (#147)";

export async function run({ check }) {
    let bodyRan = false;
    const handler = async () => {
        bodyRan = true;
        return { ok: true };
    };

    // withAdminApi's shape: the gate returns a Response on refusal.
    const refusingResponse = new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    const apiGuarded = createResponseGuard(async () => refusingResponse)(handler);
    const apiResult = await apiGuarded(new Request("https://example.test/"));
    check("withAdminApi shape — handler did not run", bodyRan, false);
    check("withAdminApi shape — refusal is the gate's own Response", apiResult === refusingResponse, true);
    check("withAdminApi shape — status preserved", apiResult.status, 403);

    // withAdminAction's shape: the gate returns { authorized }, and the call
    // site supplies the refusal. Both refusal shapes in the codebase are
    // exercised, because #147 deliberately did not unify them.
    bodyRan = false;
    const flagGuarded = createFlagGuard(async () => ({ authorized: false }))(
        () => ({ error: "Not authorized." }),
        handler
    );
    const flagResult = await flagGuarded(null, new FormData());
    check("withAdminAction shape — handler did not run", bodyRan, false);
    check("withAdminAction shape — refusal is the call site's { error }", flagResult?.error, "Not authorized.");

    bodyRan = false;
    const flagThrowing = createFlagGuard(async () => ({ authorized: false }))(() => {
        throw new Error("Not authorized");
    }, handler);
    let threw = null;
    await flagThrowing(null, new FormData()).catch((err) => {
        threw = err.message;
    });
    check("withAdminAction shape — a throwing refusal still throws", threw, "Not authorized");
    check("withAdminAction shape — handler did not run (throwing refusal)", bodyRan, false);

    // withPresidentAction's shape: the gate itself throws.
    bodyRan = false;
    const presidentGuarded = createThrowingGuard(async () => {
        throw new Error("Only the President can sign a PO.");
    })(handler);
    let presidentThrew = null;
    await presidentGuarded(null, new FormData()).catch((err) => {
        presidentThrew = err.message;
    });
    check("withPresidentAction shape — gate's throw propagates", presidentThrew, "Only the President can sign a PO.");
    check("withPresidentAction shape — handler did not run", bodyRan, false);

    // The authorized direction, so none of the above passes by refusing
    // everything, and the handler's own value is what comes back.
    bodyRan = false;
    const allowed = createFlagGuard(async () => ({ authorized: true }))(() => ({ error: "no" }), handler);
    const allowedResult = await allowed(null, new FormData());
    check("withAdminAction shape — authorized runs the handler", bodyRan, true);
    check("withAdminAction shape — authorized returns the handler's value", allowedResult?.ok, true);

    // Arguments must reach the handler untouched — the wrappers are variadic
    // because deleteInvoiceAction/deleteDraftAction take a plain id rather
    // than (prevState, formData).
    let seen = null;
    const passthrough = createFlagGuard(async () => ({ authorized: true }))(
        () => ({ error: "no" }),
        async (...args) => {
            seen = args;
            return { ok: true };
        }
    );
    await passthrough("recInvoice123");
    check("wrapper forwards a single non-formData argument", seen?.length, 1);
    check("wrapper forwards that argument's value", seen?.[0], "recInvoice123");
}

if (isMain(import.meta.url)) standalone(title, run);
