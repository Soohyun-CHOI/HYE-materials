// No Client Component may import a credentialed module (#162).
//
// WHY THIS EXISTS. lib/airtable/client.js throws `Missing AIRTABLE_API_KEY` at
// MODULE LOAD. In a Server Component that is a deliberate fail-fast; in a browser
// bundle it is an unconditional crash, because the variable is server-only by
// design. #162 shipped exactly that bug: app/deliveries/new/DeliveryForm.js
// imported one pure helper from lib/deliveryCandidates.js, which imports
// lib/airtable/client.js, and selecting a job threw in the browser.
//
// The reasoning that produced it is the part worth pinning against. The import was
// annotated as safe because "the module's Airtable readers are never called on this
// side" — which is false in a way that is easy to believe: IMPORTING A MODULE
// EXECUTES IT. Nothing tree-shakes away a dependency whose evaluation has side
// effects, so the throw happens whether or not anything calls a reader.
//
// So the boundary is not "which functions does the client call" but "which modules
// does the client import", and that is a property of the import graph — which is
// exactly what a source-shape check can see, and what a build cannot: `next build`
// compiled the broken version without complaint, because the throw is at runtime.
//
// What this canNOT see: a dynamic import(), or a module reached through a package
// entry point. Neither exists in this app today.

import { dirname, join, relative, resolve } from "path";
import { existsSync, statSync } from "fs";
import { listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Client bundle safety — no 'use client' file reaches lib/airtable/ (#162)";

// The tainted root. Anything that imports this, at any depth, cannot be in a
// browser bundle.
const FORBIDDEN = "lib/airtable/client.js";

const SCAN_ROOTS = ["app", "lib"];

/** The leading string directives of a module, e.g. "use client" / "use server". */
function directivesOf(ast) {
    const out = [];
    for (const node of ast.body || []) {
        if (node.type !== "ExpressionStatement") break;
        const v = node.expression;
        const raw = v?.type === "Literal" ? v.value : null;
        if (typeof raw !== "string") break;
        out.push(raw);
    }
    return out;
}

/** Every local (relative or @/-aliased) specifier a file imports. */
function localImportsOf(ast) {
    const out = [];
    walk(ast, (n) => {
        const src =
            (n.type === "ImportDeclaration" ||
                n.type === "ExportNamedDeclaration" ||
                n.type === "ExportAllDeclaration") &&
            n.source?.value;
        if (typeof src === "string" && (src.startsWith(".") || src.startsWith("@/"))) out.push(src);
    });
    return out;
}

/** Resolve a specifier to a repo-relative posix path, or null. */
function resolveSpecifier(fromRel, spec) {
    const base = spec.startsWith("@/")
        ? join(REPO_ROOT, spec.slice(2))
        : resolve(REPO_ROOT, dirname(fromRel), spec);

    for (const candidate of [base, `${base}.js`, `${base}.jsx`, join(base, "index.js")]) {
        if (!existsSync(candidate)) continue;
        try {
            if (statSync(candidate).isFile()) return toPosix(relative(REPO_ROOT, candidate));
        } catch {
            /* not a readable file — try the next shape */
        }
    }
    return null;
}

export function run({ check, assert, log }) {
    const files = SCAN_ROOTS.flatMap((root) => listJsFiles(join(REPO_ROOT, root))).map((f) =>
        toPosix(relative(REPO_ROOT, f))
    );

    // Import graph over every file we can parse.
    const importsByFile = new Map();
    for (const rel of files) {
        let parsed;
        try {
            parsed = parseFile(rel);
        } catch (err) {
            assert(`${rel} parses (an unparsed file is an unchecked file): ${err.message}`, false);
            continue;
        }
        const directives = directivesOf(parsed.ast);
        importsByFile.set(rel, {
            ast: parsed.ast,
            isClient: directives.includes("use client"),
            // A "use server" module is a BOUNDARY, not a dependency. Importing a
            // Server Action from a Client Component is the ordinary Next.js
            // pattern: the bundler hands the client an action id over the network
            // and never ships the module's code, so the server-only imports behind
            // it are not in the browser bundle. Traversing through one would flag
            // every form in the app.
            isServerBoundary: directives.includes("use server"),
            imports: localImportsOf(parsed.ast)
                .map((s) => resolveSpecifier(rel, s))
                .filter(Boolean),
        });
    }

    assert("found files to check", importsByFile.size > 0);
    assert(`the forbidden root ${FORBIDDEN} is itself in the graph`, importsByFile.has(FORBIDDEN));

    /**
     * Shortest import path from `start` to FORBIDDEN, or null — stopping at any
     * "use server" module, which the browser bundle does not cross.
     */
    function pathToForbidden(start) {
        const queue = [[start]];
        const seen = new Set([start]);
        while (queue.length > 0) {
            const chain = queue.shift();
            const current = chain[chain.length - 1];
            for (const next of importsByFile.get(current)?.imports || []) {
                if (next === FORBIDDEN) return [...chain, next];
                if (seen.has(next)) continue;
                seen.add(next);
                if (importsByFile.get(next)?.isServerBoundary) continue;
                queue.push([...chain, next]);
            }
        }
        return null;
    }

    const clientFiles = [...importsByFile.keys()].filter((rel) => importsByFile.get(rel).isClient);
    log(`${clientFiles.length} "use client" file(s) in ${SCAN_ROOTS.join("/")}`);
    assert("there is at least one Client Component to check", clientFiles.length > 0);

    for (const rel of clientFiles) {
        const chain = pathToForbidden(rel);
        assert(
            chain
                ? `${rel} must not reach ${FORBIDDEN} — via ${chain.slice(1).join(" -> ")}`
                : `${rel} reaches no credentialed module`,
            chain === null
        );
    }

    // The check would pass vacuously if the traversal could not find a path that
    // genuinely exists, so prove it can: a server module that really does import
    // the client must be reported as reaching it.
    const knownReacher = "lib/deliveryCandidates.js";
    if (importsByFile.has(knownReacher)) {
        assert(
            `the traversal really works — ${knownReacher} is seen to reach ${FORBIDDEN}`,
            pathToForbidden(knownReacher) !== null
        );
    }
    assert(
        "and a module that imports nothing is not falsely reported",
        pathToForbidden("lib/itemNaming.js") === null
    );
}

if (isMain(import.meta.url)) standalone(title, run);
