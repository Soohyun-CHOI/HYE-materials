// No Client Component may import a credentialed module (#162).
//
// WHY THIS EXISTS. lib/airtable/client.js throws `Missing AIRTABLE_TEST_API_KEY` at
// MODULE LOAD. In a Server Component that is a deliberate fail-fast; in a browser
// bundle it is an unconditional crash, because the variable is server-only by
// design. #162 shipped exactly that bug: app/deliveries/new/DeliveryForm.js
// imported one pure helper from lib/deliveryCandidates.js — named
// lib/deliveryAllocation.server.js since #184 — which imports
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
import { existsSync, readdirSync, statSync } from "fs";
import { listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Client bundle safety — no 'use client' file reaches lib/airtable/ (#162)";

// The tainted roots. Anything that imports one of these, at any depth, cannot be
// in a browser bundle.
//
// lib/airtableOps.js is the second one (#190). It is not credentialed and does
// not reach client.js — client.js imports IT — so a Client Component importing it
// would not be caught by the first root at all. What makes it forbidden is its
// own import of `node:async_hooks`, which has no browser equivalent, and the
// hazard is identical to #162's: an import is an execution, so nothing has to
// call AsyncLocalStorage for the bundle to break. The two pure helpers a form
// might want from it — there are none today — would have to move rather than be
// imported, exactly as buildItemOptions had to.
const NAMED_ROOTS = ["lib/airtable/client.js", "lib/airtableOps.js"];

// AND EVERY MODULE THAT THROWS AT LOAD ON A MISSING VARIABLE, FOUND RATHER THAN NAMED
// (#184). `lib/email.js` throws `Missing RESEND_API_KEY` at module load as client.js
// throws for its key, a browser holds neither, and it reaches neither root above — so a
// Client Component importing it was #162's crash with a different message, and nothing
// here could see it. `lib/session.js`, `lib/auth.js` and `lib/airtable/authTokens.js`
// take the same shape and reach client.js anyway. The shape is a top-level `if` that
// reads `process.env` and throws, so the next module written that way is a root the day
// it is written rather than the day somebody adds it to a list.
export function throwsAtLoad(ast) {
    return (ast.body || []).some((node) => {
        if (node.type !== "IfStatement") return false;
        let readsEnv = false;
        walk(node.test, (n) => {
            if (n.type === "MemberExpression" && n.object?.name === "process" && n.property?.name === "env") readsEnv = true;
        });
        const body = node.consequent.type === "BlockStatement" ? node.consequent.body : [node.consequent];
        return readsEnv && body.some((s) => s.type === "ThrowStatement");
    });
}

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

export function run({ assert, log }) {
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
    for (const root of NAMED_ROOTS) {
        assert(`the forbidden root ${root} is itself in the graph`, importsByFile.has(root));
    }
    const foundRoots = [...importsByFile.keys()].filter(
        (rel) => rel.startsWith("lib/") && throwsAtLoad(importsByFile.get(rel).ast)
    );
    const FORBIDDEN_ROOTS = [...NAMED_ROOTS, ...foundRoots.filter((rel) => !NAMED_ROOTS.includes(rel))];
    log(`${foundRoots.length} module(s) throw at load on a missing variable: ${foundRoots.join(", ")}`);
    // The shape has to be seen finding the module it was written for, or a parser
    // change could leave it finding nothing while every client file still passed.
    assert("the load-time shape finds lib/email.js, which no named root covers", foundRoots.includes("lib/email.js"));

    /**
     * Shortest import path from `start` to any forbidden root, or null — stopping
     * at any "use server" module, which the browser bundle does not cross.
     */
    function pathToForbidden(start) {
        const queue = [[start]];
        const seen = new Set([start]);
        while (queue.length > 0) {
            const chain = queue.shift();
            const current = chain[chain.length - 1];
            for (const next of importsByFile.get(current)?.imports || []) {
                if (FORBIDDEN_ROOTS.includes(next)) return [...chain, next];
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
                ? `${rel} must not reach ${chain[chain.length - 1]} — via ${chain.slice(1).join(" -> ")}`
                : `${rel} reaches no server-only module`,
            chain === null
        );
    }

    // The check would pass vacuously if the traversal could not find a path that
    // genuinely exists, so prove it can: a server module that really does import
    // the client must be reported as reaching it.
    //
    // NOT GUARDED BY WHETHER THE FILE EXISTS, AS IT WAS UNTIL #184: that issue renamed
    // the file this named, and under the guard a rename would have skipped the proof
    // without a word.
    const knownReacher = "lib/deliveryAllocation.server.js";
    assert(
        `the traversal really works — ${knownReacher} is seen to reach a forbidden root`,
        pathToForbidden(knownReacher) !== null
    );
    // The same proof for the SECOND root, which would otherwise be a name in a
    // list that nothing demonstrates the traversal can find (#190). client.js is
    // what imports lib/airtableOps.js, so it must be seen to reach it.
    assert(
        "and the second root is reachable too — lib/airtable/client.js reaches lib/airtableOps.js",
        pathToForbidden("lib/airtable/client.js")?.includes("lib/airtableOps.js") === true
    );
    assert(
        "and a module that imports nothing is not falsely reported",
        pathToForbidden("lib/typedText.js") === null
    );

    // THE NAME SAYS WHICH SIDE A MODULE IS ON (#184). A rule split across this line is
    // a pair — its judgment and its words in `x.js`, every read and write it makes
    // against the base in `x.server.js` — so whoever writes a Client Component reads
    // what it may import off the file name. That holds only while the names are true,
    // so both halves are held here: an `x.server.js` reaches a root, and the `x.js`
    // beside it reaches none and exists.
    const serverHalves = [...importsByFile.keys()].filter((rel) => rel.startsWith("lib/") && rel.endsWith(".server.js"));
    log(`${serverHalves.length} pair(s) named for the line: ${serverHalves.map((rel) => rel.slice(4, -10)).join(", ")}`);
    assert("there is at least one pair to hold", serverHalves.length > 0);
    for (const rel of serverHalves) {
        const pure = rel.replace(/\.server\.js$/, ".js");
        assert(`${rel} reaches a forbidden root, as its name says`, pathToForbidden(rel) !== null);
        assert(`  and ${pure} beside it exists`, importsByFile.has(pure));
        const chain = importsByFile.has(pure) ? pathToForbidden(pure) : null;
        assert(
            chain ? `  and ${pure} must not reach ${chain[chain.length - 1]} — via ${chain.slice(1).join(" -> ")}` : `  and ${pure} reaches none`,
            chain === null
        );
    }

    // `server-only` GOES ON A MODULE NO PLAIN-NODE SCRIPT LOADS, AND THIS HOLDS IT THERE
    // (#184). The marker makes `next build` refuse a Client Component that reaches it,
    // which nothing above does at build time — but plain `node` cannot load it: the
    // package is not installed, Next's bundler resolves the bare name itself, and an
    // installed copy throws under `node`'s `default` condition. Every credentialed
    // module is reached by a `verify-*`, `demo` or `import` script, so the marker stays
    // off them; a module carrying it fails here the day a script reaches it, with the
    // chain, rather than a script failing at load with a bare resolution error.
    const marked = [...importsByFile.keys()].filter((rel) =>
        (importsByFile.get(rel).ast.body || []).some((n) => n.type === "ImportDeclaration" && n.source?.value === "server-only")
    );
    log(`${marked.length} module(s) carry server-only: ${marked.join(", ")}`);
    assert("lib/email.js carries the marker, which is what the scripts below are held against", marked.includes("lib/email.js"));
    const scripts = listMjsFiles(join(REPO_ROOT, "scripts")).map((f) => toPosix(relative(REPO_ROOT, f)));
    const scriptImports = new Map(
        scripts.map((rel) => [rel, localImportsOf(parseFile(rel).ast).map((s) => resolveSpecifier(rel, s)).filter(Boolean)])
    );
    const importsOf = (rel) => scriptImports.get(rel) || importsByFile.get(rel)?.imports || [];
    function pathToMarked(start) {
        const queue = [[start]];
        const seen = new Set([start]);
        while (queue.length > 0) {
            const chain = queue.shift();
            for (const next of importsOf(chain[chain.length - 1])) {
                if (marked.includes(next)) return [...chain, next];
                if (seen.has(next)) continue;
                seen.add(next);
                queue.push([...chain, next]);
            }
        }
        return null;
    }
    log(`${scripts.length} script(s) under scripts/ checked for a server-only module`);
    assert("there are scripts to check", scripts.length > 0);
    for (const rel of scripts) {
        const chain = pathToMarked(rel);
        if (chain) assert(`${rel} must not reach ${chain[chain.length - 1]} under plain node — via ${chain.slice(1).join(" -> ")}`, false);
    }
    // And the walk is seen reaching one: lib/auth.js imports lib/email.js.
    assert("the script walk really works — lib/auth.js is seen to reach lib/email.js", pathToMarked("lib/auth.js") !== null);
}

/** Every `.mjs` file under `dir`, skipping what `listJsFiles` skips. */
function listMjsFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) listMjsFiles(full, out);
        else if (entry.name.endsWith(".mjs")) out.push(full);
    }
    return out;
}

if (isMain(import.meta.url)) standalone(title, run);
