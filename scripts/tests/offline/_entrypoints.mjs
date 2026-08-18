// What counts as an entry point, enumerated once (#224).
//
// TWO CHECKS ASK DIFFERENT QUESTIONS OF THE SAME LIST, which is why the list is
// here and the questions are not. `authz-structure.mjs` asks whether each
// endpoint export is gated; `airtable-ops.mjs` asks whether each entry point
// opens an ops-label scope. They do not agree on scope — a page carries its
// authorization inside its own body rather than in a wrapper, so authz has no
// inventory of pages, while ops must cover every page — and they do not agree on
// verdicts. What they share is the mechanical part: classify a file, collect its
// exports, notice a function-level "use server". Written twice, that part would
// be two enumerations to keep in step, and the failure mode is silent: a surface
// one of them stops seeing simply stops being checked.
//
// #218's census is the reason this is executable rather than a list in a
// document. It counted 40 entry points by treating an actions.js FILE as one,
// and a file is not an entry point: `withOpsLabel` opens inside one exported
// function, so `app/prs/[prId]/actions.js` counted as labeled while four of its
// five actions were not. The unit is the EXPORT, and the honest figure at #224
// was 55.
//
// SCANNED IN FULL, and `lib` is included for the same reason authz-structure
// gave: app/ holds every route and action, and lib/ is scanned so a "use server"
// file appearing there is not invisible. Pages only exist under app/.

import { join, relative } from "path";
import { listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";

export const SCAN_ROOTS = ["app", "lib"];

export const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export const isRouteFile = (rel) => /^app\/api\/.*\/route\.js$/.test(rel);
export const isPageFile = (rel) => /^app\/(.*\/)?page\.js$/.test(rel);

/**
 * The route TEMPLATE a page or route file serves, which is the label a page
 * takes and half the label a Route Handler takes. Derived from the path rather
 * than typed, so a label cannot disagree with where its file lives.
 */
export function routeTemplate(rel) {
    const p = rel.replace(/^app/, "").replace(/\/(page|route)\.js$/, "");
    return p === "" ? "/" : p;
}

function directivesOf(body) {
    const out = [];
    for (const node of Array.isArray(body) ? body : []) {
        if (node.type !== "ExpressionStatement") break;
        const v = node.directive ?? (node.expression?.type === "Literal" ? node.expression.value : null);
        if (typeof v !== "string") break;
        out.push(v);
    }
    return out;
}

export const hasUseServerDirective = (ast) => directivesOf(ast.body).includes("use server");
export const hasUseClientDirective = (ast) => directivesOf(ast.body).includes("use client");

// Function-level "use server" — an inline Server Action declared inside a
// component rather than in an actions.js module. None exist today, and this
// finds any that appear: they are directly callable like every other action,
// so one showing up unwrapped should fail rather than pass by not being looked
// for. The fix for a hit is to move it into an actions.js file and wrap it, or
// to add an exemption with a reason.
export function findInlineServerActions(ast) {
    const found = [];
    walk(ast, (n) => {
        const isFn =
            n.type === "FunctionDeclaration" ||
            n.type === "FunctionExpression" ||
            n.type === "ArrowFunctionExpression";
        if (isFn && n.body?.type === "BlockStatement" && directivesOf(n.body.body).includes("use server")) {
            found.push(n.id?.name || "<anonymous inline action>");
        }
    });
    return found;
}

// Every export, with whatever it was initialized to. A re-export specifier
// carries no initializer, so it lands as uninitialized and has to be justified —
// the safe default.
export function collectExports(ast) {
    const found = [];
    for (const node of ast.body) {
        if (node.type === "ExportDefaultDeclaration") {
            found.push({ name: "default", init: node.declaration, node });
        } else if (node.type === "ExportNamedDeclaration") {
            if (node.declaration?.type === "FunctionDeclaration") {
                found.push({ name: node.declaration.id.name, init: null, node });
            } else if (node.declaration?.type === "VariableDeclaration") {
                for (const d of node.declaration.declarations) {
                    found.push({ name: d.id.name, init: d.init, node });
                }
            } else if (node.specifiers?.length) {
                for (const s of node.specifiers) {
                    found.push({ name: s.exported.name, init: null, node });
                }
            }
        }
    }
    return found;
}

/**
 * Every entry point under SCAN_ROOTS.
 *
 * `kind` is one of `page`, `route`, `action`, `inline action`. A page is the
 * default export of an `app/**\/page.js`; a route is one HTTP-method export of an
 * `app/api/**\/route.js`; an action is any export of a `"use server"` file.
 *
 * `onParseError` is called with a message rather than thrown, because an
 * unparsed file is an UNCHECKED file and each caller wants to fail on it in its
 * own voice — silence would be the one outcome neither check can afford.
 */
export function listEntryPoints({ onParseError = () => {} } = {}) {
    const entries = [];
    const files = { page: new Set(), route: new Set(), action: new Set() };

    for (const root of SCAN_ROOTS) {
        for (const abs of listJsFiles(join(REPO_ROOT, root))) {
            const rel = toPosix(relative(REPO_ROOT, abs));
            let parsed;
            try {
                parsed = parseFile(rel);
            } catch (err) {
                onParseError(err.message);
                continue;
            }
            const { ast } = parsed;

            for (const name of findInlineServerActions(ast)) {
                entries.push({ file: rel, name, init: null, ast, kind: "inline action" });
            }

            const route = isRouteFile(rel);
            const action = hasUseServerDirective(ast);
            const page = isPageFile(rel);

            if (page) {
                files.page.add(rel);
                for (const exp of collectExports(ast)) {
                    if (exp.name !== "default") continue;
                    entries.push({ file: rel, name: exp.name, init: exp.init, ast, kind: "page" });
                }
            }
            if (!route && !action) continue;

            if (route) files.route.add(rel);
            if (action) files.action.add(rel);
            for (const exp of collectExports(ast)) {
                if (route && !HTTP_METHODS.has(exp.name)) continue;
                entries.push({
                    file: rel,
                    name: exp.name,
                    init: exp.init,
                    ast,
                    kind: route ? "route" : "action",
                });
            }
        }
    }

    return { entries, files };
}

/**
 * An INDEPENDENT count of the files each kind should have come from — by FILE
 * NAME, not through the predicates above.
 *
 * This exists because the anti-vacuity assertions that ask "did the enumeration
 * find any pages" cannot see an enumeration that finds SOME. Fifteen of
 * twenty-one pages would pass every per-entry assertion and every count-is-
 * positive assertion, and the check would be green with six screens unexamined.
 *
 * SHARING THE PREDICATE WOULD HAVE MADE THIS VACUOUS, and that is measured
 * rather than reasoned: the first version called `isPageFile` here, so narrowing
 * `isPageFile` to skip `app/admin/` moved BOTH numbers together — the
 * enumeration dropped from 55 entry points to 52, three admin pages went
 * unexamined, and every assertion still passed. Counting `page.js` and
 * `route.js` by name is the second path that has to disagree when the first one
 * narrows. Nothing here may be expressed in terms of isPageFile/isRouteFile.
 */
export function countEntryPointFiles() {
    let page = 0;
    let route = 0;
    for (const root of SCAN_ROOTS) {
        for (const abs of listJsFiles(join(REPO_ROOT, root))) {
            const rel = toPosix(relative(REPO_ROOT, abs));
            const segments = rel.split("/");
            const name = segments[segments.length - 1];
            if (name === "page.js" && segments[0] === "app") page += 1;
            if (name === "route.js" && segments[0] === "app" && segments[1] === "api") route += 1;
        }
    }
    return { page, route };
}
