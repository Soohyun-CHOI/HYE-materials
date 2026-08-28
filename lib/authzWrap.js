// Guard factories (issue #147).
//
// These convert "the caller must act on the gate's return value" into "the
// gate runs and the handler doesn't", which is the difference between a
// convention and a rule. lib/authz.js's requireAdmin()/requireAdminApi()
// only *report* a decision, so `await requireAdmin();` with the flag
// dropped compiles, lints, runs, and admits everyone. A wrapped export has
// no such shape: the handler is an argument the factory decides whether to
// call.
//
// Deliberately a module of its own rather than more code in lib/authz.js,
// for one measured reason: authz.js imports next/navigation + next/server,
// and a plain `node` script importing it fails with ERR_MODULE_NOT_FOUND on
// 'next/navigation' (the authz verification script has carried that note
// since #134). Nothing here imports next/*, so that script can import
// these factories and inject a refusing gate to prove the handler body never
// runs. That check then exercises the production control flow instead of a
// restatement of it — the whole point of #147.
//
// The gate is a parameter HERE and nowhere else. lib/authz.js exports the
// three wrappers with their gates already bound, so a call site chooses a
// wrapper by name and has no argument position in which to pass the wrong
// gate.
//
// EVERY GATE CALL BELOW OPENS ITS OWN OPS SCOPE (#224), AND THIS IS WHERE THE
// ONLY OPERATIONS #224 COULD NOT PUT UNDER AN ENDPOINT'S OWN LABEL LIVE. A gate
// reads the session — one Airtable find — and it necessarily runs BEFORE the
// handler, so it is outside the scope the handler opens. Moving the endpoint's
// scope outside the wrapper would fix that and is refused: the export's
// initializer would stop being `withAdminApi(...)`, which is exactly what
// offline/authz-structure.mjs reads to prove the export is gated at all, so the
// instrument would be bought with a weaker security check.
//
// SO THE GATE'S OPERATION GETS ITS OWN NAME RATHER THAN FALLING TO `unlabeled`.
// That bucket has to keep meaning one thing — nobody labeled this — because
// #224's guarantee is read off it being empty; an operation that IS labeled and
// merely runs before its endpoint's scope is a different fact and reads as a
// half-finished sweep if the two are mixed. One constant label for all three
// factories, because the figure is the same find wherever it runs and no screen
// wants it broken out. The label is written inline rather than through a
// constant because offline/airtable-ops.mjs requires a string literal there.
//
// lib/airtableOps.js is importable under plain `node`, so the property this
// module exists for is unchanged: scripts/tests/verify-authz.mjs can still
// import these factories and inject a refusing gate, and
// offline/authz-wrappers.mjs can still exercise them with no credentials.
//
// THE IMPORT BELOW SPELLS THE EXTENSION OUT, and that is not a style choice:
// the offline tier runs under plain `node` with no loader, so an extensionless
// `./airtableOps` is unresolvable there and takes this module — and every
// offline check that imports it — down with it. Same reason
// lib/materialPriceView.js imports `"./itemNaming.js"` (#19). Measured: with the
// extension dropped, offline/authz-wrappers.mjs fails as "NOT offline".

import { withOpsLabel } from "./airtableOps.js";

/**
 * For a gate that returns a Response on refusal (requireAdminApi) — the
 * Route Handler shape. The refusal is already a complete HTTP answer, so
 * there is nothing for the call site to supply.
 */
export function createResponseGuard(gate) {
    return function wrap(handler) {
        return async function guarded(...args) {
            const refusal = await withOpsLabel("authz gate", () => gate());
            if (refusal instanceof Response) return refusal;
            return handler(...args);
        };
    };
}

/**
 * For a gate that returns { authorized } (requireAdmin) — the Server Action
 * shape. `refuse` is a thunk the call site provides, and #185 settled what it
 * may contain.
 *
 * THE SHAPE FOLLOWS WHETHER THE CALL SITE BINDS THE RETURN VALUE, not the
 * action's role. Three bindings exist and two of them can observe a return:
 * `useActionState(action, init)` makes it `state`, and `await action(...)` in a
 * client handler makes it a value; a bare `<form action={action}>` DISCARDS it.
 * So an action whose every call site binds refuses by returning `{ error }`,
 * which the form renders where it already renders its validation refusals; an
 * action any call site invokes without binding throws, because there is nothing
 * for a returned refusal to reach.
 *
 * THE RULE IS A CONJUNCTION OVER CALL SITES, and what to do when they disagree
 * is part of it: one non-binding caller makes the rule say throw, which costs
 * the binding caller its inline message — so a mixture is the signal to change
 * that caller, not to change the shape. `offline/action-refusal-shape.mjs`
 * enumerates every wrapped action and holds both halves.
 *
 * THIS DOCSTRING COUNTED THE TWO SHAPES UNTIL #185 and the count was already
 * stale: #272 added a ninth action and made "four and four" false without
 * touching this file. What splits them is written above instead, so the sentence
 * cannot go stale by anyone adding an action.
 *
 * `refuse` comes first so a long handler body doesn't push it out of sight.
 */
export function createFlagGuard(gate) {
    return function wrap(refuse, handler) {
        return async function guarded(...args) {
            const { authorized } = await withOpsLabel("authz gate", () => gate());
            if (!authorized) return refuse();
            return handler(...args);
        };
    };
}

/**
 * For a gate that throws on refusal (requirePresident). Control cannot
 * continue past the gate, so again there is no refusal for the call site to
 * choose. This wrapper adds no safety that requirePresident() didn't already
 * have — it exists so the structural check's rule stays one clause
 * ("wrapped, or exempt with a reason") instead of carrying two more
 * exemptions.
 */
export function createThrowingGuard(gate) {
    return function wrap(handler) {
        return async function guarded(...args) {
            await withOpsLabel("authz gate", () => gate());
            return handler(...args);
        };
    };
}
