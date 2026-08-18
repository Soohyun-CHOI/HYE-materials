// The guard wrappers' control flow — a refused gate must not run the handler.
//
// Extracted by #152 from verify-authz.mjs Part D. Same story as pr-visibility:
// it was already offline (lib/authzWrap.js imported nothing at all — that is why
// #147 put the factories there) but it lived in a file that imports Airtable,
// so it could only be reached with credentials.
//
// #224 gave that module ONE import, lib/airtableOps.js, so its gate calls can be
// attributed. The offline property is unchanged and now rests on something
// narrower than "imports nothing": airtableOps reaches only node:async_hooks, and
// the import spells its extension out, without which this file fails as "NOT
// offline" under the loader-less tier.
//
// This is the one property the structural check cannot see. authz-structure.mjs
// proves each endpoint export IS wrapped; only calling a wrapper with a
// refusing gate proves that being wrapped stops the body. The factories are the
// production ones; only the gate is injected, which is the seam #147 added for
// exactly this and which the bound wrappers in lib/authz.js do not expose.

import { createResponseGuard, createFlagGuard, createThrowingGuard } from "../../../lib/authzWrap.js";
import {
    UNLABELED,
    recordOperation,
    resetOps,
    snapshot,
    withOpsLabel,
} from "../../../lib/airtableOps.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Guard wrappers — a refused gate must not run the handler (#147)";

export async function run({ check, assert }) {
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

    // ── the gate's own operations are attributed (#224) ──────────────────────
    // A gate reads the session, and it runs BEFORE the handler, so its operation
    // is outside whatever scope the handler opens. #224 refused to let that land
    // in `unlabeled`, because that bucket has to keep meaning "nobody labeled
    // this" — it is what says the sweep is complete. So each factory scopes its
    // own gate call, and this is the runtime half of that claim: the offline
    // entry-point check can see that every export opens a scope, and nothing in
    // it can see WHERE an operation lands.
    //
    // Exercised through the production factories with an injected gate, the same
    // seam every check above uses.
    resetOps();
    const counted = createFlagGuard(async () => {
        recordOperation("get", "/Users/recABCDEFGHIJKLMN");
        return { authorized: true };
    })(() => ({ error: "no" }), async () => {
        // The handler's own scope, as every wrapped export now opens one.
        return withOpsLabel("someAction", async () => {
            recordOperation("get", "/Purchase%20Orders");
            return { ok: true };
        });
    });
    await counted(null, new FormData());
    const snap = snapshot();
    check("the gate's read is attributed to `authz gate`", snap.byLabel["authz gate"], 1);
    check("the handler's read is attributed to the handler", snap.byLabel.someAction, 1);
    assert("and nothing landed in the unlabeled bucket", snap.byLabel[UNLABELED] === undefined);
    // THE GATE SCOPE MUST CLOSE BEFORE THE HANDLER OPENS ITS OWN, or "outermost
    // wins" would take the handler's operations too and every wrapped endpoint
    // would report as `authz gate`. That is the failure this pair rules out.
    assert("the gate scope did not swallow the handler's label", snap.byLabel["authz gate"] !== 2);
    resetOps();
}

if (isMain(import.meta.url)) standalone(title, run);
