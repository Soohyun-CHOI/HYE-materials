// Counting every Airtable operation, and attributing it to a screen, a Server
// Action or a script (#190).
//
// WHY THIS EXISTS. This base spent roughly 60,000 API calls between 1 and 6
// August 2026, with one developer, no deployment and no users, and nothing in the
// repo could say where they went — Airtable reports a per-base total with no
// breakdown by endpoint, token or code path. Verification runs account for maybe
// 5,000-8,000 of it. The rest was unattributed, so there was nothing to optimize
// against: two questions were waiting on this figure (whether the dev loop or the
// credentialed tier is the larger consumer, and whether any screen pays more than
// it needs to) and Airtable's per-base rate limit of 5 requests/second — which
// cannot be raised on any plan — makes "how many concurrent users" a question
// about operations per screen and nothing else.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT AN "OPERATION" IS, AND WHY THIS NUMBER IS A FLOOR
//
// One operation is ONE LOGICAL AIRTABLE REQUEST: one page of a select, one
// find, one create, one update, one destroy. Airtable bills HTTP ATTEMPTS, and
// the two differ in two measured ways, both of which push the real figure UP.
// So treat every number here as a floor, never as the billed total.
//
//   1. RETRIES ARE INVISIBLE HERE. On a 429, airtable@0.12.2 retries with
//      backoff — and `run_action.js` recurses into its own module-local
//      `runAction`, NOT back through `Base.prototype.runAction`, so a request
//      that took three HTTP attempts passes this counter exactly once. Wrapping
//      the callback would not help either: the 429 branch never calls the
//      callback, it only recurses, so the callback always sees the final
//      attempt's status. Timing cannot stand in for it — the backoff is
//      `Math.random() * min(5000 * 2^n, 600000)`, and that leading `Math.random()`
//      means a retry can add close to zero delay.
//
//      The only layer that sees a retry is the transport: `lib/fetch.js`
//      resolves to node-fetch@2.7.0 under Node, which requires `http`/`https`,
//      so `https.request` is where real attempts are countable.
//      `verify-airtable-ops-190.mjs` measures the ratio there once rather than
//      leaving this paragraph as a caveat.
//
//   2. RAW `fetch()` IS INVISIBLE HERE. Seven credentialed scripts call the
//      Metadata API (`api.airtable.com/v0/meta/...`) directly, bypassing the SDK.
//      Nothing in this module can see those.
//
// One difference that runs the other way, worth knowing when comparing against
// verify-material-price-19.mjs: `select()` builds a Query lazily and issues
// nothing, so an un-awaited select costs 0 operations here and 1 at that
// script's layer. See the cross-check note in that file's Part E.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHERE IT HOOKS, AND WHY NOT WHERE #19 DID
//
// `Base.prototype.runAction` is the single funnel: `query.js` calls it once per
// PAGE, `table.js` for create/update/destroy/list, and `record.js` for the
// single-record patch/put/destroy/fetch. Every read and write in this app is one
// of those.
//
// verify-material-price-19.mjs hooks `Table.prototype._selectRecords` /
// `_findRecordById` instead, which was right for what it needed — it proves "no
// per-row find() on the search path", a claim about operations initiated at the
// call site. It is the wrong layer here for four reasons: it is two funnels
// rather than one; it cannot see WRITES, which is the half #190 exists to add;
// it counts one select as 1 however many pages it fetches (that file's own
// comment names this as its precision limit); and `method` + `path` give us the
// table name and the operation kind from the REQUEST, so the breakdown cannot be
// mislabeled by a call site. `runAction` also appears on the library's own public
// functor, where `_selectRecords` is underscore-private.
//
// It carries `@deprecated` in base.js, which is a real risk — but query.js,
// table.js and record.js all call it, so removing it is a library rewrite rather
// than a version bump. PINNED_AIRTABLE_VERSION below is what turns that risk
// into a build failure.
//
// THE INSTANCE, NOT THE PROTOTYPE. `Table`, `Query` and `Record` all reach the
// Base through `this._base` / `this._table._base` — our single instance — and
// they read `.runAction` at CALL time. So an own-property assignment on that one
// object is seen by everything created from it while mutating nothing global. A
// prototype patch is acceptable in a test harness and not in production code.
//
// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITY — A COUNTER THAT READS 0 LOOKS EXACTLY LIKE AN EFFICIENT APP
//
// #19's instrument guards itself with one `> 0` assertion inside the check that
// uses it, and its own comment says that assertion "is the thing that turns this
// from a check that can lie into one that fails loudly". This instrument lives in
// production code, so it needs more than one:
//
//   - installOpsCounter() THROWS if the funnel is not there, so a blind
//     instrument is an app that does not boot. Consistent with client.js, which
//     already throws at module load for a missing key.
//   - PINNED_AIRTABLE_VERSION is compared against package.json by
//     offline/airtable-ops.mjs, so bumping the dependency fails CI. THE THROW
//     ALONE WOULD NOT COVER THIS: it fires at client.js's module load, and the
//     offline tier never loads that file, so an airtable upgrade would pass CI
//     and land on the first production request instead.
//     WHAT THE PIN PROVES IS THAT SOMEBODY LOOKED, NOT THAT THE WRAPPER STILL
//     WORKS. It is a prompt to re-read base.js/table.js/query.js/record.js and
//     re-run verify-airtable-ops-190.mjs; only that run can say the wrapper
//     still sees anything.
//   - offline/airtable-ops.mjs pins classifyRequest() against the six real
//     request shapes those four files build.
//   - verify-airtable-ops-190.mjs asserts a real read AND a real write are both
//     counted, that an operation inside a label scope lands under that label
//     rather than in UNLABELED, and measures the transport ratio from (1).
//
// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY. This module imports `node:async_hooks` and is imported by
// lib/airtable/client.js. Nothing under a "use client" directive may import it,
// at any depth — see offline/client-import-safety.mjs, where it is the second
// forbidden root. The reason is #162's: an import is an execution.

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The airtable version whose request funnel was read line by line for #190.
 *
 * Checked against package.json by offline/airtable-ops.mjs. See the anti-vacuity
 * note above for what a match does and does not prove.
 */
export const PINNED_AIRTABLE_VERSION = "0.12.2";

/** The bucket for operations nobody labeled. See withOpsLabel. */
export const UNLABELED = "unlabeled";

/**
 * MODULE STATE LIVES ON `globalThis`, AND THAT IS A MEASUREMENT FIX RATHER THAN
 * A STYLE CHOICE. Next's dev server re-evaluates a module on change, which would
 * give each generation its own Map and split one page's operations across two
 * stores — and the dev loop is precisely what #190 wants to measure. Both keys
 * are `Symbol.for`, i.e. the process-global registry, so every generation of this
 * module resolves the same symbol; a module-local `Symbol()` would be a fresh
 * symbol per generation and defeat the point.
 */
const STORE_KEY = Symbol.for("hye.airtableOps.store");
const WRAPPED_KEY = Symbol.for("hye.airtableOps.wrapped");

function store() {
    if (!globalThis[STORE_KEY]) {
        globalThis[STORE_KEY] = { counts: new Map(), total: 0 };
    }
    return globalThis[STORE_KEY];
}

// One AsyncLocalStorage, also global for the reason above: a scope opened by one
// generation of this module must be readable by the counter in another.
const LABEL_KEY = Symbol.for("hye.airtableOps.labelStorage");
function labelStorage() {
    if (!globalThis[LABEL_KEY]) globalThis[LABEL_KEY] = new AsyncLocalStorage();
    return globalThis[LABEL_KEY];
}

const SEP = " ";

/**
 * Which operation a request is, and on which table — derived from the request
 * itself rather than from the call site, so no caller can mislabel it.
 *
 * PURE, and separate from the wrapper for exactly that reason: these are the six
 * shapes airtable@0.12.2 builds, they are enumerable from its source, and the
 * offline tier pins them. Taken from:
 *
 *   query.js:eachPage      get    /Table            (one PAGE of a select)
 *                          post   /Table/listRecords (the same, when the URL
 *                                                     would exceed 16kb)
 *   table.js:_listRecords  get    /Table/           (the deprecated list path)
 *   table.js:_createRecords     post   /Table/
 *   table.js:_updateRecords     patch|put  /Table/      (batch)
 *   table.js:_destroyRecord     delete /Table           (batch)
 *   record.js:fetch             get    /Table/recXXX
 *   record.js:patchUpdate/putUpdate  patch|put /Table/recXXX
 *   record.js:destroy           delete /Table/recXXX
 *
 * The trailing slash carries no meaning — what decides is whether the second
 * segment is a record id, `listRecords`, or absent.
 *
 * `create` cannot be split into single and batch: `_createRecords` posts to the
 * same path either way. The destroy and update pairs CAN be, and are, because
 * "how many of these are one-at-a-time" is the whole question #191 asks.
 *
 * An unrecognized shape is reported as `unknown` rather than dropped or guessed
 * at — a path form added by a future airtable version should show up as a number
 * nobody can explain, not vanish into a plausible one.
 */
export function classifyRequest(method, path) {
    const verb = String(method || "").toLowerCase();
    const segments = String(path || "")
        .split("?")[0]
        .split("/")
        .filter((s) => s.length > 0);

    const table = segments.length > 0 ? safeDecode(segments[0]) : "(unknown)";
    const second = segments[1] ?? null;
    const extra = segments.length > 2;

    // A record id, or the listRecords sub-resource, or nothing.
    const target = second === null ? "collection" : second === "listRecords" ? "listRecords" : /^rec/.test(second) ? "record" : "other";

    if (extra || target === "other") return { kind: "unknown", table };

    if (verb === "get") return { kind: target === "record" ? "find" : "list", table };
    if (verb === "post") return { kind: target === "listRecords" ? "list" : target === "collection" ? "create" : "unknown", table };
    if (verb === "patch" || verb === "put") {
        return { kind: target === "record" ? "update" : target === "collection" ? "update-batch" : "unknown", table };
    }
    if (verb === "delete") {
        return { kind: target === "record" ? "destroy" : target === "collection" ? "destroy-batch" : "unknown", table };
    }
    return { kind: "unknown", table };
}

function safeDecode(segment) {
    try {
        return decodeURIComponent(segment);
    } catch {
        // A malformed escape is not worth throwing over inside an instrument.
        return segment;
    }
}

/** Record one operation. Called by the wrapper; exported for the offline tier. */
export function recordOperation(method, path) {
    const { kind, table } = classifyRequest(method, path);
    const scope = labelStorage().getStore();
    const label = scope ? scope.label : UNLABELED;

    const s = store();
    const key = `${label}${SEP}${table}${SEP}${kind}`;
    s.counts.set(key, (s.counts.get(key) || 0) + 1);
    s.total += 1;

    // The scope keeps its OWN tally rather than the log subtracting a before and
    // after from the global one: two concurrent scopes would otherwise each
    // report the other's operations, and Fluid Compute reuses one instance across
    // concurrent requests.
    if (scope) {
        scope.total += 1;
        const local = `${table}${SEP}${kind}`;
        scope.counts.set(local, (scope.counts.get(local) || 0) + 1);
    }
    return { kind, table, label };
}

/**
 * Attribute every operation inside `fn` to `label`.
 *
 * THE OUTERMOST SCOPE WINS — a nested call is a no-op that keeps the outer
 * label. Attribution is meant to answer "what did this SCREEN cost", so a
 * service-layer scope must not steal the page's operations. It also means a
 * label placed deeper in the stack acts as a default: it takes effect only when
 * nothing above it labeled, which is what makes one usable from a script.
 *
 * The log is in a `finally` because `redirect()` throws — every page and Server
 * Action in this app ends that way, so a scope that logged on the success path
 * only would report nothing for most of them.
 *
 * Label convention: a route TEMPLATE for a page (`/prs/[prId]`, so forty PR
 * detail loads aggregate into one row instead of forty), the exported name for a
 * Server Action, the filename for a script.
 */
export async function withOpsLabel(label, fn) {
    if (labelStorage().getStore()) return fn();

    const scope = { label, total: 0, counts: new Map() };
    return labelStorage().run(scope, async () => {
        try {
            return await fn();
        } finally {
            logScope(scope);
        }
    });
}

/** The label an operation would be attributed to right now, for tests. */
export function currentOpsLabel() {
    return labelStorage().getStore()?.label ?? UNLABELED;
}

/**
 * COUNTING IS ALWAYS ON; PRINTING IS GATED. The counter is a Map write against a
 * ~100ms network call, so always-on costs nothing measurable, and it avoids the
 * failure mode of an instrument that is switched off exactly when someone asks
 * the question. Separating the two means the gate can only lose the PRINTOUT —
 * snapshot() still has the data.
 *
 * AIRTABLE_OPS_LOG: unset prints nothing, `1`/`summary` prints one line per
 * scope, `verbose` adds a line per table and kind.
 */
function logMode() {
    const raw = (process.env.AIRTABLE_OPS_LOG || "").toLowerCase();
    if (raw === "verbose") return "verbose";
    if (raw === "1" || raw === "true" || raw === "summary") return "summary";
    return "off";
}

function logScope(scope) {
    const mode = logMode();
    if (mode === "off") return;

    const byKind = new Map();
    const byTable = new Map();
    for (const [key, n] of scope.counts) {
        const [table, kind] = key.split(SEP);
        byKind.set(kind, (byKind.get(kind) || 0) + n);
        byTable.set(table, (byTable.get(table) || 0) + n);
    }
    const kinds = [...byKind].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
    console.log(`[airtable-ops] ${scope.label} — ${scope.total} ops${kinds ? ` (${kinds})` : ""}`);

    if (mode !== "verbose") return;
    for (const [table, n] of [...byTable].sort((a, b) => b[1] - a[1])) {
        const detail = [...scope.counts]
            .filter(([key]) => key.split(SEP)[0] === table)
            .map(([key, c]) => `${key.split(SEP)[1]} ${c}`)
            .join(", ");
        console.log(`[airtable-ops]     ${table}: ${n} (${detail})`);
    }
}

/**
 * Everything counted since the last reset, flattened.
 *
 * `rows` is one entry per label/table/kind; `byLabel` is the aggregate a reader
 * usually wants; `unknown` is how many operations classifyRequest could not
 * name, which should be 0 and is worth asserting.
 */
export function snapshot() {
    const s = store();
    const rows = [];
    const byLabel = {};
    let unknown = 0;
    for (const [key, count] of s.counts) {
        const [label, table, kind] = key.split(SEP);
        rows.push({ label, table, kind, count });
        byLabel[label] = (byLabel[label] || 0) + count;
        if (kind === "unknown") unknown += count;
    }
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { total: s.total, rows, byLabel, unknown };
}

export function resetOps() {
    const s = store();
    s.counts.clear();
    s.total = 0;
}

/** A one-line-per-row rendering of snapshot(), for a script's own output. */
export function formatSnapshot(snap = snapshot()) {
    const lines = [`total ${snap.total} operations`];
    for (const [label, n] of Object.entries(snap.byLabel).sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${label}: ${n}`);
        for (const row of snap.rows.filter((r) => r.label === label)) {
            lines.push(`      ${row.table} ${row.kind}: ${row.count}`);
        }
    }
    return lines.join("\n");
}

/**
 * Wrap the request funnel of one Airtable base functor. Returns the functor, so
 * the call site stays a single expression.
 *
 * Two properties are wrapped, and the second one matters even though nothing in
 * this repo uses it today: `Base.createFunctor` takes a BOUND COPY of runAction
 * onto the functor (`baseFn.runAction`), so a caller reaching that copy would
 * bypass a patch applied only to the instance. `baseFn.makeRequest` is a
 * different code path with its own fetch and its own retry loop; nothing here
 * calls it, and it is NOT counted.
 *
 * DOUBLE-WRAP GUARD. Assigning over `runAction` twice would count one operation
 * as two, and a doubled figure is plausible enough that nobody would question it
 * — worst of all in the dev loop, where Next re-evaluates modules on change and
 * where #190 most wants a trustworthy number. The marker is a `Symbol.for` for
 * that same reason: a module-local symbol would be a new symbol in the new
 * generation and would not recognize the existing wrapper.
 */
export function installOpsCounter(baseFunctor) {
    const instance = baseFunctor?._base;
    if (!instance || typeof instance.runAction !== "function") {
        throw new Error(
            "lib/airtableOps.js: this airtable build does not expose Base#runAction, so the " +
                "operation counter (#190) can see nothing. A counter that reads 0 is " +
                "indistinguishable from an efficient app, so this is a throw rather than a " +
                "warning. Re-read the request funnel in node_modules/airtable/lib/" +
                "{base,table,query,record}.js, update installOpsCounter and " +
                `PINNED_AIRTABLE_VERSION (pinned at ${PINNED_AIRTABLE_VERSION}), and re-run ` +
                "scripts/tests/verify-airtable-ops-190.mjs."
        );
    }

    if (!instance.runAction[WRAPPED_KEY]) {
        const original = instance.runAction.bind(instance);
        const wrapped = function (method, path, queryParams, bodyData, callback) {
            recordOperation(method, path);
            return original(method, path, queryParams, bodyData, callback);
        };
        wrapped[WRAPPED_KEY] = true;
        instance.runAction = wrapped;
    }

    // The functor's bound copy, taken before the line above ran.
    if (typeof baseFunctor.runAction === "function" && !baseFunctor.runAction[WRAPPED_KEY]) {
        baseFunctor.runAction = instance.runAction.bind(instance);
        baseFunctor.runAction[WRAPPED_KEY] = true;
    }

    installExitReport();
    return baseFunctor;
}

/**
 * Print the process total on exit when logging is on.
 *
 * THIS IS WHAT MAKES A SCRIPT MEASURABLE FOR FREE. A page or a Server Action has
 * a scope with a beginning and an end, so withOpsLabel can report it; a
 * verification script has neither, and the alternative was editing sixteen of
 * them to print a snapshot. A process total is exactly the figure wanted there —
 * "what did this run cost" — and it needs no call site at all.
 *
 * `process.on("exit")` because it fires on a normal return AND on an explicit
 * process.exit(), which is how every credentialed script ends. Registered once,
 * keyed in the global registry for the same reason as the store: dev-server
 * module re-evaluation would otherwise add a listener per generation.
 */
const EXIT_KEY = Symbol.for("hye.airtableOps.exitReport");
function installExitReport() {
    if (globalThis[EXIT_KEY]) return;
    globalThis[EXIT_KEY] = true;
    process.on("exit", () => {
        if (logMode() === "off") return;
        const snap = snapshot();
        if (snap.total === 0) return;
        console.log(`\n[airtable-ops] process total — ${snap.total} operations`);
        console.log(formatSnapshot(snap));
    });
}
