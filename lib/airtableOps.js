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
// ONE DATA POINT ON THE FIRST OF THOSE QUESTIONS, measured while verifying #176.
// Four navigations to `/pos` produced FOURTEEN renders of it in the log. Ten were
// the dev server recompiling after files changed on disk — a stash and an unstash
// — and a re-render pays the page's full operation count, so roughly 90
// operations went out with nobody looking at a screen.
//
// WHAT THAT SUGGESTS THE HEADLINE NUMBER IS. A screen costing 9 operations costs
// 9 every time Next re-renders it, and in a dev session that is several times per
// navigation and many times per edit. So the figure worth optimizing may be
// RENDERS PER EDIT rather than operations per render — which is a different lever
// from anything a page's own query shape can reach, and this module cannot see it
// at all: nothing here distinguishes a render a person asked for from one a file
// save caused. An observation, not a diagnosis; recorded where the question is.
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
// WHAT IS ATTRIBUTED, AND WHAT IS ONLY COUNTED — A SECOND LIMIT, DIFFERENT FROM
// THE FLOOR ABOVE
//
// The floor is about HTTP attempts. This one is about which operations ever get
// a LINE. Counting is unconditional — the wrapper on runAction records every
// operation into the store no matter who called it — but a per-scope console
// line and a per-scope JSONL record are written only by withOpsLabel's
// `finally`. An operation outside every scope lands in UNLABELED and surfaces
// nowhere except the process total, and for `next dev` that total is the race
// documented under THE FILE LOG below, which it usually loses.
//
// SO AN UNLABELED SCREEN LOOKS FREE, AND IT IS NOT. Measured on #218's browser
// run: `/pos` and `/pos/[poId]` printed 8 and 11 operations, while
// `/prs/new`, `/deliveries` and `POST /api/auth/verify` printed nothing at all.
// The last of those cannot have cost nothing — spending a single-use token is a
// write. Its operations were counted; no line was ever produced for them.
//
// COVERAGE, COUNTED RATHER THAN ESTIMATED — 8 of 40 entry points as of #218:
//
//   pages            7 of 21   /, /prs, /prs/[prId], /pos, /pos/[poId],
//                              /deliveries/new, /login/confirm
//   Route Handlers   0 of  9   none, including every upload path and
//                              /api/auth/verify
//   Server Actions   1 of 10   approveAction
//
// So the whole of `/invoices`, `/materials`, `/deliveries` and `app/admin`, and
// every write a Server Action makes except one, are invisible per-screen today.
//
// WHY THAT MATTERS BEYOND TIDINESS: AN UNLABELED SCREEN HAS NO BEFORE AND AFTER.
// The reason to attribute at all was "does any screen pay more than it needs
// to", and a change to an unlabeled screen cannot be measured against itself —
// there is no prior number to compare with, and the process total moves for
// reasons that have nothing to do with the screen. Per-screen design work is
// where this will be hit first, because a per-screen budget is exactly the thing
// the unlabeled 32 cannot supply. Adding a label is one wrapper at a route's
// export and is cheap, but it is a behavior change, and #218 — where this was
// diagnosed, while removing dark mode — carries none. So the labeling is left
// out on purpose and picked up as its own piece of work rather than folded in
// here. The counts above are what was true when that decision was made; CLAUDE.md
// states the rule without them, because a ratio goes stale on the first label.
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
import { appendFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

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

// NUL, because a table name and a label both legitimately contain spaces, so a
// space-separated key would split wrongly on "Purchase Requests". Written as an
// ESCAPE rather than a raw byte: a literal NUL in the source makes ripgrep treat
// this file as binary and SKIP it, which would hide it from the grep sweep
// CLAUDE.md's field-rename procedure depends on. Same value, visible file.
// Exported so offline/airtable-ops.mjs can build counts keys the same way this
// module does, and pin summarizeScope against the real measured renders. Not a
// production API.
export const OPS_KEY_SEP = "\u0000";
const SEP = OPS_KEY_SEP;

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
            reportScope(scope);
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

// ───────────────────────────────────────────────────────────────────────────────
// THE FILE LOG (#190, second commit)
//
// WHY THE CONSOLE IS NOT ENOUGH. The output was scattered across processes and
// none of it survived. Verification scripts are the most expensive unit measured —
// 159 and 487 operations per run — and they mostly run in an agent session, whose
// stdout Soo never sees and which is gone when the session ends. Meanwhile Soo has
// no access to Airtable's own Usage tab; the workspace owner reporting heavy API
// use is what started this issue. So this file is the only evidence available, and
// the only thing that can be shown to the owner.
//
// IT ALSO COVERS THE Ctrl-C HOLE, and the hole is measured rather than assumed:
//   - Plain `node` receiving SIGINT with no SIGINT listener does NOT run
//     `process.on("exit")` handlers. Measured directly: a script that prints from
//     an exit handler printed nothing after `kill -INT`. So a verification script
//     interrupted with Ctrl-C loses its process record, and there is no scope
//     boundary in a script to have written anything earlier.
//   - For `next dev` it is a RACE, not a guarantee. The dev CLI is a parent
//     process and our renders run in a CHILD (next-dev.js:149 kills it). The child
//     does register SIGINT -> `cleanup` -> `process.exit` (start-server.js:389), so
//     an exit handler CAN run — but the parent SIGKILLs the child
//     `CHILD_EXIT_TIMEOUT_MS` after signaling, default **100ms**, and SIGKILL
//     cannot be caught. An exit report that loses that race is simply gone.
// A per-scope line owes nothing to either mechanism: each render's record is on
// disk before the next request starts, so Ctrl-C costs at most the process total,
// which is derivable by summing the scope lines anyway.
//
// FORMAT: JSONL, one object per line. Three reasons. The per-table breakdown has
// variable arity, so there is no honest column form for it. Both questions this
// has to answer later — "how much last week" and "how much was scripts versus the
// dev server" — are aggregations, and aggregating JSONL is a three-line script
// where parsing an ad-hoc text format is guesswork. And one record being one line
// is what makes the append atomic (see appendRecord). The human-facing rendering
// is the console output, which is unchanged in kind; this file is the durable
// record. Two one-liners for the two questions:
//
//   node -e "const r=require('fs').readFileSync('.airtable-ops.jsonl','utf8').trim().split('\n').map(JSON.parse); console.log(r.filter(x=>x.kind==='process').reduce((n,x)=>n+x.ops,0))"
//   node -e "const r=require('fs').readFileSync('.airtable-ops.jsonl','utf8').trim().split('\n').map(JSON.parse); const b={}; for(const x of r) if(x.kind==='process') b[x.proc]=(b[x.proc]||0)+x.ops; console.log(b)"
//
// NOTHING IDENTIFYING IS WRITTEN. A record carries a label, table names, operation
// kinds and counts — never a record id, a field value, or a formula. The closed
// key set is asserted in offline/airtable-ops.mjs, because "we only write counts"
// is the kind of claim that decays when someone adds a debugging field.

export const DEFAULT_OPS_FILE = ".airtable-ops.jsonl";

/**
 * Where to append, or null for off. Pure — `env` and `cwd` are parameters so the
 * offline tier can pin every branch without touching the real environment.
 *
 * `1`/`true` means the conventional path, which is what makes the .gitignore entry
 * meaningful; anything else is taken as a path, resolved against cwd.
 */
export function resolveOpsFile(env = process.env, cwd = process.cwd()) {
    const raw = (env.AIRTABLE_OPS_FILE || "").trim();
    if (raw === "" || raw.toLowerCase() === "0" || raw.toLowerCase() === "false") return null;
    const target = raw === "1" || raw.toLowerCase() === "true" ? DEFAULT_OPS_FILE : raw;
    return isAbsolute(target) ? target : join(cwd, target);
}

/**
 * Which process wrote a record — the answer to "scripts or the dev server".
 *
 * Parameterized for the same reason as resolveOpsFile. A verification script's
 * entry point is its own filename, which is more useful than a two-value enum:
 * `verify-overage-167.mjs` names the run. Next's server runs from inside its own
 * package, so that is collapsed to `next`.
 */
export function processTag(argv1 = process.argv[1], runtime = process.env.NEXT_RUNTIME) {
    if (runtime) return "next";
    const entry = String(argv1 || "");
    if (/[\\/]next[\\/]dist[\\/]/.test(entry)) return "next";
    const name = entry.split(/[\\/]/).pop();
    return name || "node";
}

/** One scope's record. Pure; `now` is a parameter so a check can pin the shape. */
export function buildScopeRecord(label, summary, now = new Date().toISOString(), meta = {}) {
    const by = {};
    for (const [table, entry] of summary.byTable) {
        by[table] = Object.fromEntries(entry.kinds);
    }
    return {
        t: now,
        pid: meta.pid ?? process.pid,
        proc: meta.proc ?? processTag(),
        kind: "scope",
        label,
        ops: summary.ops,
        tables: summary.tables,
        repeats: summary.repeats,
        by,
    };
}

/**
 * The process total.
 *
 * THE ONLY PLACE UNLABELED OPERATIONS ARE RECORDED, which is why it carries
 * per-label detail rather than just a number: a verification script opens no scope
 * at all, so every one of its operations is unlabeled and this record is the whole
 * of what the file learns about that run.
 */
export function buildProcessRecord(snap, now = new Date().toISOString(), meta = {}) {
    return {
        t: now,
        pid: meta.pid ?? process.pid,
        proc: meta.proc ?? processTag(),
        kind: "process",
        ops: snap.total,
        labels: { ...snap.byLabel },
    };
}

/** Every key a record may carry. Asserted offline — see the note above. */
export const RECORD_KEYS = ["t", "pid", "proc", "kind", "label", "ops", "tables", "repeats", "by", "labels"];

const FILE_STATE = Symbol.for("hye.airtableOps.fileState");
function fileState() {
    if (!globalThis[FILE_STATE]) globalThis[FILE_STATE] = { disabled: false };
    return globalThis[FILE_STATE];
}

/**
 * Append one record as one line.
 *
 * ONE COMPLETE LINE PER `appendFileSync` CALL, INCLUDING THE NEWLINE, and that is
 * the whole of the concurrency story. A dev server and a script can be running at
 * once, and both may hold the same file. An `O_APPEND` write — which is what the
 * `a` flag opens — seeks and writes as one operation, so two writers cannot land
 * at the same offset; what O_APPEND does NOT protect against is a single logical
 * line split across two write calls, where the other process's line can land in
 * the middle. Our lines are one short JSON object each, a few hundred bytes, far
 * below any partial-write threshold, and are built in memory and handed over in
 * one call. So the mitigation is a rule about this function rather than a lock:
 * never build a line in two writes, and never write the multi-line report as one
 * string. offline/airtable-ops.mjs asserts there is exactly one append call here.
 *
 * SYNCHRONOUS, for two reasons rather than preference: `process.on("exit")` can
 * only do synchronous work, so the process record has no async option; and an
 * async append could still be queued when the process ends, which is precisely
 * the record most worth keeping. Cost is one short write per scope — tens of
 * microseconds against a render that has already spent 100ms+ on the network, so
 * well under a tenth of a percent. It is nonetheless sync I/O on the request
 * path, so this is a development and script facility: off unless the variable is
 * set, and not something to enable on a shared production instance, where it
 * would block the event loop for concurrent requests and where Vercel has no
 * durable writable filesystem to append to anyway.
 *
 * NEVER THROWS, AND NEVER GOES QUIET. A logging failure must not take down a
 * request. But silence is the exact failure this whole module exists to prevent,
 * so the first failure warns on stderr — naming the path, the reason, and that
 * the file is now INCOMPLETE, which is what a later total would otherwise get
 * wrong — and then disables itself for the process rather than warning per
 * render. A flood of identical warnings is a warning nobody reads.
 */
function appendRecord(record) {
    const state = fileState();
    if (state.disabled) return;
    const target = resolveOpsFile();
    if (!target) return;

    try {
        appendFileSync(target, `${JSON.stringify(record)}\n`);
    } catch (err) {
        state.disabled = true;
        console.error(
            `[airtable-ops] could not append to ${target} (${err.message}) — file logging is OFF ` +
                "for the rest of this process and the file is INCOMPLETE, so any total taken from " +
                "it will be short. Counting and console output are unaffected."
        );
    }
}

/**
 * The shape of one scope's operations: how many, over how many tables, and how
 * many of them were repeat reads of a table already read.
 *
 * WHY `repeats` IS THE BASELINE A READER NEEDS. `13 ops` alone says nothing —
 * whether 13 is good or bad depends on how many tables the page had to touch, and
 * finding that out meant counting the rows of the breakdown by hand. If a page
 * needs a table it should normally fetch it in one go, so a healthy page has ops
 * ≈ tables. `ops - tables` is exactly the number of repeat reads, because it is
 * the sum over tables of (count - 1). Measured against real renders: `/prs` is 7
 * ops over 5 tables, 2 repeats, both of them `Users: find`; `/prs/[prId]` is 13
 * over 7, 6 repeats, being `Purchase Requests: find 5` and `Users: find 2`.
 *
 * A SIGNAL, NOT A VERDICT. A table over Airtable's 100-record page legitimately
 * costs several `list` operations, and that is pagination rather than waste — so
 * `repeated` carries the KIND MIX, which is what lets a reader tell the two apart
 * without the line having to guess: repeated `list` on one table looks like
 * paging, repeated `find` looks like 1 + N. Neither reading belongs in the log.
 */
export function summarizeScope(counts) {
    const byTable = new Map();
    const byKind = new Map();
    for (const [key, n] of counts) {
        const [table, kind] = key.split(SEP);
        byKind.set(kind, (byKind.get(kind) || 0) + n);
        if (!byTable.has(table)) byTable.set(table, { ops: 0, kinds: new Map() });
        const entry = byTable.get(table);
        entry.ops += n;
        entry.kinds.set(kind, (entry.kinds.get(kind) || 0) + n);
    }
    let ops = 0;
    for (const [, entry] of byTable) ops += entry.ops;

    const repeated = [...byTable]
        .filter(([, entry]) => entry.ops > 1)
        .sort((a, b) => b[1].ops - a[1].ops || a[0].localeCompare(b[0]))
        .map(([table, entry]) => ({
            table,
            ops: entry.ops,
            kinds: [...entry.kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`),
        }));

    return {
        ops,
        tables: byTable.size,
        repeats: ops - byTable.size,
        byKind: [...byKind].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`),
        byTable,
        repeated,
    };
}

/** The one-line console rendering of a scope. Pure, so the offline tier pins it. */
export function formatScopeLine(label, summary) {
    const kinds = summary.byKind.length > 0 ? ` (${summary.byKind.join(", ")})` : "";
    const repeats = summary.repeats > 0 ? `${summary.repeats} repeats` : "no repeats";
    return `[airtable-ops] ${label} — ${summary.ops} ops, ${summary.tables} tables, ${repeats}${kinds}`;
}

/** The follow-up line naming where the repeats are, or null when there are none. */
export function formatRepeatedLine(summary) {
    if (summary.repeated.length === 0) return null;
    const parts = summary.repeated.map((r) => `${r.table} ×${r.ops} (${r.kinds.join(", ")})`);
    return `[airtable-ops]     repeated: ${parts.join(", ")}`;
}

function reportScope(scope) {
    const summary = summarizeScope(scope.counts);

    // TWO INDEPENDENT SWITCHES. The file record is not a copy of the console
    // output and must be written even with console logging off, which is the
    // ordinary case for a dev server someone is not watching.
    appendRecord(buildScopeRecord(scope.label, summary));

    const mode = logMode();
    if (mode === "off") return;

    console.log(formatScopeLine(scope.label, summary));
    const repeated = formatRepeatedLine(summary);
    if (repeated) console.log(repeated);

    if (mode !== "verbose") return;
    for (const [table, entry] of [...summary.byTable].sort((a, b) => b[1].ops - a[1].ops)) {
        const detail = [...entry.kinds].map(([k, c]) => `${k} ${c}`).join(", ");
        console.log(`[airtable-ops]     ${table}: ${entry.ops} (${detail})`);
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
        const snap = snapshot();
        if (snap.total === 0) return;
        // The file record first, and independent of the console switch — see the
        // two-switch note in reportScope. For a script this is the only record
        // the file gets, since a script opens no scope.
        appendRecord(buildProcessRecord(snap));
        if (logMode() === "off") return;
        console.log(`\n[airtable-ops] process total — ${snap.total} operations`);
        console.log(formatSnapshot(snap));
    });
}
