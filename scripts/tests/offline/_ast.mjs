// Source-shape helpers for the offline tier (issue #152).
//
// Why these exist: the checks that assert "this call site calls X before it
// does Y" used to work on text — codeOnly() to strip comments, then indexOf()
// on `export async function NAME`. That broke twice. #147 wrapped ten exports
// (`export const NAME = withAdminAction(refuse, NAMEHandler)`), the literal
// `export async function NAME` stopped existing, the extractor returned "",
// and six checks silently reported false while the production guards were all
// intact. Nothing surfaced it because those checks sat in scripts that need
// Airtable credentials to reach.
//
// So: parse, don't match. Two things follow from that beyond rename-safety.
//
//   1. resolveFunction() follows a wrapped export to the function that holds
//      the body — inline argument or identifier reference — so wrapping an
//      export no longer hides it.
//   2. Several assertions get to be the actual property instead of a proxy
//      for it. "cleanup is outside the rollback" was a string comparison
//      against the text of an error-return; it is now "the call has no
//      enclosing TryStatement", which is what was meant. Same for "scheduled
//      with after()" (an enclosing after() call) and "not awaited inline"
//      (no enclosing AwaitExpression).
//
// What this still does NOT do, and must not be read as doing: SOURCE order is
// not EXECUTION order. `callsBefore()` proves the gate call appears earlier in
// the file than the work call. A gate inside `if (false)`, or after an early
// return, satisfies it. Where a property can be reached behaviourally instead,
// that is strictly better — see CLAUDE.md's note on converting the two
// signPOAction/regeneratePDFAction placement checks to direct Server Action
// invocation.

import { readdirSync, readFileSync } from "fs";
import { dirname, join, posix, resolve, sep } from "path";
import { fileURLToPath } from "url";
import { Parser } from "acorn";
import jsx from "acorn-jsx";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// JSX-aware: lib/poPdf.js and every component under app/ is .js with JSX in
// it, and a file this layer cannot parse is a file it cannot check.
const JsxParser = Parser.extend(jsx());

export function toPosix(p) {
    return p.split(sep).join(posix.sep);
}

export function repoPath(relPath) {
    return join(REPO_ROOT, relPath);
}

export function listJsFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) listJsFiles(full, out);
        else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
}

/** Parse one repo-relative file. Throws with the path on a parse failure. */
export function parseFile(relPath) {
    const source = readFileSync(repoPath(relPath), "utf8");
    try {
        const ast = JsxParser.parse(source, { ecmaVersion: "latest", sourceType: "module" });
        return { ast, source, relPath };
    } catch (err) {
        throw new Error(`${relPath}: could not parse (${err.message})`);
    }
}

const SKIP_KEYS = new Set(["type", "start", "end", "loc", "range", "parent"]);

/** Depth-first walk; visitor sees every node. */
export function walk(node, visit) {
    (function visitNode(n) {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) {
            for (const c of n) visitNode(c);
            return;
        }
        if (typeof n.type !== "string") return;
        visit(n);
        for (const key of Object.keys(n)) {
            if (SKIP_KEYS.has(key)) continue;
            visitNode(n[key]);
        }
    })(node);
}

/** Map every node in a subtree to its parent, so ancestry can be asked about. */
function parentMap(root) {
    const parents = new Map();
    (function visitNode(n, parent) {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) {
            for (const c of n) visitNode(c, parent);
            return;
        }
        if (typeof n.type !== "string") return;
        parents.set(n, parent);
        for (const key of Object.keys(n)) {
            if (SKIP_KEYS.has(key)) continue;
            visitNode(n[key], n);
        }
    })(root, null);
    return parents;
}

function calleeName(node) {
    if (node?.type !== "CallExpression") return null;
    const c = node.callee;
    if (c?.type === "Identifier") return c.name;
    if (c?.type === "MemberExpression" && c.property?.type === "Identifier") return c.property.name;
    return null;
}

const isFunctionNode = (n) =>
    n?.type === "FunctionDeclaration" ||
    n?.type === "FunctionExpression" ||
    n?.type === "ArrowFunctionExpression";

/**
 * The function body associated with `name`, following a wrapped export to the
 * handler it was given.
 *
 * Handles, in order:
 *   function name() {}                     / export async function name() {}
 *   export const name = <fn>               (arrow or function expression)
 *   export const name = wrapper(<fn>)      (#147's withAdminApi/withPresidentAction)
 *   export const name = wrapper(x, <fn>)   (#147's withAdminAction: refuse first)
 *   export const name = wrapper(x, handlerIdent)  -> resolves handlerIdent
 *
 * Returns null when nothing matches, which callers must treat as a failure
 * rather than as "no violation found" — an unresolvable name is the exact
 * shape of the bug this replaces.
 */
export function resolveFunction(ast, name, seen = new Set()) {
    if (seen.has(name)) return null;
    seen.add(name);

    for (const node of ast.body) {
        // function name() / export (async) function name()
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
        if (decl?.type === "FunctionDeclaration" && decl.id?.name === name) return decl;

        // const name = ... / export const name = ...
        if (decl?.type === "VariableDeclaration") {
            for (const d of decl.declarations) {
                if (d.id?.name !== name || !d.init) continue;
                if (isFunctionNode(d.init)) return d.init;
                if (d.init.type === "CallExpression") {
                    // Last function-ish argument is the handler: the wrappers
                    // put refusal first and the body last.
                    const args = [...d.init.arguments].reverse();
                    for (const arg of args) {
                        if (isFunctionNode(arg)) return arg;
                        if (arg?.type === "Identifier") {
                            const resolved = resolveFunction(ast, arg.name, seen);
                            if (resolved) return resolved;
                        }
                    }
                }
            }
        }
    }
    return null;
}

/** Every call to `name` inside a subtree, in source order. */
export function callsTo(node, name) {
    const found = [];
    walk(node, (n) => {
        if (calleeName(n) === name) found.push(n);
    });
    return found.sort((a, b) => a.start - b.start);
}

export function callsFunction(node, name) {
    return callsTo(node, name).length > 0;
}

/**
 * Does the first call to `gate` appear before the first call to `work`?
 * Source order — see the limitation note at the top of this file.
 */
export function callsBefore(node, gate, work) {
    const g = callsTo(node, gate)[0];
    const w = callsTo(node, work)[0];
    if (!g || !w) return false;
    return g.start < w.start;
}

/** Is `target` (a node) lexically inside a try block within `root`? */
export function insideTry(root, target) {
    const parents = parentMap(root);
    let cur = parents.get(target);
    let child = target;
    while (cur) {
        if (cur.type === "TryStatement" && cur.block === child) return true;
        child = cur;
        cur = parents.get(cur);
    }
    return false;
}

/** Is `target` inside a call to `ancestorCallee` within `root`? */
export function insideCallTo(root, target, ancestorCallee) {
    const parents = parentMap(root);
    let cur = parents.get(target);
    while (cur) {
        if (calleeName(cur) === ancestorCallee) return true;
        cur = parents.get(cur);
    }
    return false;
}

/** Is `target` the operand of an await within `root`? */
export function isAwaited(root, target) {
    const parents = parentMap(root);
    const parent = parents.get(target);
    return parent?.type === "AwaitExpression";
}

/**
 * Does any argument of `callNode` (looking through arrays and object
 * literals) carry a property named `propName`? Used for "this cleanup target
 * names the attachment it is confirming".
 */
export function callPassesProperty(callNode, propName) {
    let found = false;
    walk(callNode, (n) => {
        if (n.type === "Property" && (n.key?.name === propName || n.key?.value === propName)) found = true;
    });
    return found;
}

/** Source position of the first node satisfying `predicate`, or -1. */
export function firstPositionOf(node, predicate) {
    let best = -1;
    walk(node, (n) => {
        if (predicate(n) && (best === -1 || n.start < best)) best = n.start;
    });
    return best;
}

/** Position of the first call to `name`, or -1. */
export function firstCallPosition(node, name) {
    const first = callsTo(node, name)[0];
    return first ? first.start : -1;
}

export { calleeName, isFunctionNode };
