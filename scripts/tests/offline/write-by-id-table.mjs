// Every write by record id goes through the batch form (#444).
//
// WHY A BATCH FORM IS THE RULE, MEASURED RATHER THAN ASSUMED. Airtable answers a
// request addressed to one table with another table's row when handed that row's id:
// a `find` returns it, a single-record `update` rewrites it when every field it names
// exists there too, and a single-record `destroy` DELETES IT OUTRIGHT — the last with
// no field to gate it, so it is the one that crosses unconditionally (#444, and the
// #440 measurement it extends, are in docs/notes/airtable-access.md). The batch forms
// of `update` and `destroy` do NOT cross: Airtable validates each id against the table
// addressed and refuses one that is not a row of it, atomically, before anything is
// written — measured `ROW_DOES_NOT_EXIST` for batch update and `NOT_FOUND` for batch
// destroy. So converting every write to the batch form makes Airtable itself the
// backstop, whether or not the caller proved the id first, and turns "prove the id
// belongs to this table" from a discipline every action has to remember into a
// property the platform enforces.
//
// WHAT THIS CHECKS, AND WHY IT IS A PURE SYNTACTIC RULE. Every `base(...).update`,
// `base(...).destroy` and `base(...).replace` under app/ and lib/ must be the batch
// form — its first argument a LITERAL array at the call site. No exemptions: a single
// exception would be exactly the primitive #444 removed from the app.
//
// WHY THE ARGUMENT MUST BE A LITERAL ARRAY, not merely "an array". `destroy(id)` and
// `destroy([id])` are told apart only by the first argument being an `ArrayExpression`;
// `update(id, fields)` and `update([{ id, fields }])` likewise, since an options
// argument makes the count unreliable. A first argument passed by VARIABLE is
// indistinguishable on the AST from a single-record id, so it would reopen the hole to
// this checker — which is why a batch write spells its array at the call site. Airtable
// would refuse a foreign id in either spelling; the literal is what keeps the check
// sound and exemption-free.
//
// WHAT THIS CANNOT SEE. It governs the SDK's `base(...)` funnel only — `create` is not
// here because a create carries no id and cannot cross, and a raw `fetch` to the REST
// API would be invisible (there is none). Source shape is not execution: a batch call
// inside `if (false)` passes. That the batch form actually refuses a foreign id is
// Airtable's behavior, re-measured every run by verify-write-by-id-table-444.mjs
// (Parts P3/P5, with R as the control) so this guarantee fails loudly if the platform
// ever changes it.

import { REPO_ROOT, listJsFiles, parseFile, parseSource, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every write by record id goes through the batch form (#444)";

/** The `base(...)` methods that mutate a record by its id — the ones that can cross. */
const GOVERNED = new Set(["update", "destroy", "replace"]);

/** Repo-relative posix paths of every .js file under `dir`. */
function jsFilesUnder(dir) {
    return listJsFiles(`${REPO_ROOT}/${dir}`)
        .map((full) => toPosix(full).slice(toPosix(REPO_ROOT).length + 1))
        .sort();
}

function lineOf(source, node) {
    return source.slice(0, node.start).split("\n").length;
}

/**
 * If `call` is `base(...).<method>(...)` for a governed method, the method name;
 * otherwise null. The receiver must be a call of the identifier `base` — which is how
 * `session.destroy()` and a PDF task's `.destroy()` are left alone, their receivers
 * being something other than `base(...)`.
 */
function governedMethod(call) {
    if (call.type !== "CallExpression") return null;
    const callee = call.callee;
    if (callee?.type !== "MemberExpression" || callee.computed) return null;
    const method = callee.property?.name;
    if (!GOVERNED.has(method)) return null;
    const obj = callee.object;
    if (obj?.type === "CallExpression" && obj.callee?.type === "Identifier" && obj.callee.name === "base") {
        return method;
    }
    return null;
}

/** Is this governed call the batch form — first argument a literal array? */
function isBatch(call) {
    return call.arguments[0]?.type === "ArrayExpression";
}

/** Every governed `base(...)` mutation in a parsed AST, with whether it is batched. */
function baseMutations(ast) {
    const found = [];
    walk(ast, (n) => {
        const method = governedMethod(n);
        if (method) found.push({ node: n, method, batched: isBatch(n) });
    });
    return found;
}

export function run({ check, assert, log }) {
    const allFiles = [...jsFilesUnder("app"), ...jsFilesUnder("lib")];
    const parsed = new Map(allFiles.map((rel) => [rel, parseFile(rel)]));

    log("EVERY base(...) update/destroy/replace is the batch form:");
    const singles = [];
    let governedSeen = 0;
    for (const rel of allFiles) {
        const { ast, source } = parsed.get(rel);
        for (const m of baseMutations(ast)) {
            governedSeen += 1;
            if (!m.batched) singles.push(`${rel}:${lineOf(source, m.node)} base(...).${m.method}(<non-array>)`);
        }
    }
    check("no single-record write by id remains", singles.join(", "), "");
    // ANTI-VACUITY: a walk that finds nothing passes the line above for the wrong
    // reason. The app has dozens of these; require the walk to have seen them.
    assert(`  and the walk found the writes it governs (${governedSeen})`, governedSeen > 0);

    // ANTI-VACUITY for the verdict: each single-record form is seen to fail, each batch
    // form to pass, and a non-base receiver and a create are left alone.
    log("");
    log("the rule refuses each single-record form and accepts each batch form:");
    const only = (src) => baseMutations(parseSource(src).ast);
    const singleUpdate = only('async function f(id, fields) { return base("T").update(id, fields); }\n');
    assert("a single-record update is caught", singleUpdate.length === 1 && singleUpdate[0].batched === false);
    const singleDestroy = only('async function f(id) { return base("T").destroy(id); }\n');
    assert("  a single-record destroy is caught", singleDestroy.length === 1 && singleDestroy[0].batched === false);
    const singleReplace = only('async function f(id, fields) { return base("T").replace(id, fields); }\n');
    assert("  a single-record replace is caught", singleReplace.length === 1 && singleReplace[0].batched === false);
    const batchUpdate = only('async function f(id, fields) { return base("T").update([{ id, fields }]); }\n');
    check("  a batch update passes", batchUpdate.length === 1 && batchUpdate[0].batched, true);
    const batchDestroy = only('async function f(id) { return base("T").destroy([id]); }\n');
    check("  a batch destroy passes", batchDestroy.length === 1 && batchDestroy[0].batched, true);
    // A first argument passed by variable is indistinguishable from a single-record id,
    // so it is refused on purpose — a batch write spells its array at the call site.
    const batchByVariable = only('async function f(records) { return base("T").update(records); }\n');
    assert("  and a batch passed by variable is refused, since the AST cannot tell it from a single id", batchByVariable[0].batched === false);
    // Left alone: a receiver that is not base(...), and create/select, which carry no id.
    const nonBase = only("async function f(session, task) { session.destroy(); task.destroy(); }\n");
    check("  a destroy on something other than base(...) is ignored", nonBase.length, 0);
    const createSelect = only('async function f() { await base("T").create([{ fields: {} }]); return base("T").select({}); }\n');
    check("  create and select are not governed", createSelect.length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);
