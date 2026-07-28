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

/**
 * For a gate that returns a Response on refusal (requireAdminApi) — the
 * Route Handler shape. The refusal is already a complete HTTP answer, so
 * there is nothing for the call site to supply.
 */
export function createResponseGuard(gate) {
    return function wrap(handler) {
        return async function guarded(...args) {
            const refusal = await gate();
            if (refusal instanceof Response) return refusal;
            return handler(...args);
        };
    };
}

/**
 * For a gate that returns { authorized } (requireAdmin) — the Server Action
 * shape. `refuse` is a thunk the call site provides, because this project's
 * Server Actions do not refuse uniformly: four throw and four return
 * { error } for the caller to render inline, and both are deliberate (see
 * app/admin/lines/new/actions.js's note on why a thrown error has no error
 * boundary to land on). Keeping refusal as the call site's argument
 * preserves each existing behaviour exactly instead of legislating one.
 *
 * `refuse` comes first so a long handler body doesn't push it out of sight.
 */
export function createFlagGuard(gate) {
    return function wrap(refuse, handler) {
        return async function guarded(...args) {
            const { authorized } = await gate();
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
            await gate();
            return handler(...args);
        };
    };
}
