// No export in `lib/` that nothing outside its own file imports (#182).
//
// WHY A CHECK AND NOT A SWEEP. Six things shipped with no reader and were found
// later rather than by anything: `upsertMaterial` sat unused from Phase 0 to #18
// carrying three defects, `PO Items."PO Record ID"` was created for a query that
// was never written, and `vendorsForJob` could never have been called at all —
// it sat in the module whose import was the crash #162 was raised about. The
// lesson is narrower than "old code rots": a function written before its consumer
// is verified by nothing, and how long that lasts is set by the plan rather than
// by the code. So the audit is the issue and this is what makes it not recur.
//
// IT WALKS THE IMPORT GRAPH, which is `client-import-safety.mjs`'s shape and for
// the same reason: whether an export has a reader is a property of who imports
// it, not of how it looks. Resolution handles `@/`-aliased and relative
// specifiers, default and namespace imports, and `export ... from` re-exports.
//
// THE CORPUS IS WIDER THAN THE SUBJECT, and that is the half most likely to be
// got wrong. The subject is `lib/**`; the importers are every `.js`/`.jsx`/`.mjs`
// under `app/`, `lib/`, `scripts/` and `components/` PLUS the repo-root files,
// which a walk of those four directories misses — `proxy.js` is live source at
// the root, and reading only the four would have reported anything it alone
// imports as unread. `source-bytes.mjs` learned the same lesson from the other
// side when 24 tracked files sat outside its extension scope.
//
// A CHECK FILE IS A READER. 38 exports in `lib/` are imported only by
// `scripts/tests/offline/`, and they are not findings: a check that pins a
// constant BY VALUE is exactly the reader this repository's documentation style
// rests on, and deleting one would break the check that names it. The rule is
// "outside its own file", not "outside `lib/`".
//
// NO EXEMPTION LIST, AND NOT AN EMPTY ONE. `fixture-cleanup.mjs`'s header states
// the principle this borrows: a script that cannot use the fixture helper is
// evidence the helper is wrong, not a line to add. The same reading here — an
// export that cannot lose the keyword is evidence this rule is wrong, and an
// empty list would be a place to put that evidence instead of acting on it.
// #182 resolved all eight of its findings by dropping `export`, so there is
// nothing to excuse; if a real exception ever appears, the list is written then,
// against a case rather than against a hypothesis.
//
// WHAT IT CANNOT SEE, and #182 established the boundary by building the detector
// and measuring it rather than by reasoning:
//
//   * A PROPERTY OF A RETURNED OBJECT that nothing reads. A name-keyed detector
//     found six — `recordToAddress.country`, `recordToMaterialPrice.priceLabel`,
//     `recordToMaterial.materialPrices` and three kept with reasons — and it is
//     UNSOUND in the direction that matters: `recordToMaterial.committedQty` has
//     no reader of a Material and still reads as live, because
//     `recordToPOItem.committedQty` shares the name. Separating them is type or
//     dataflow analysis, which is not this tier.
//   * #217's SHAPE, which is narrower again: a field of a returned object that
//     its only consumer OVERRIDES. The name IS read — by the consumer that
//     overrides it — so no import graph and no name census can see it. That one
//     is a review matter and is stated here rather than anywhere else, because
//     the place a reader asks "is this covered" is the check that covers the
//     neighbouring case.
//   * AN AIRTABLE FIELD with no reader. That needs the base, so it is
//     `verify-unread-fields-182.mjs` in the credentialed tier, and its own header
//     carries what the Metadata API will not answer.

import { dirname, join, relative, resolve } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import { parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "No export in lib/ that nothing outside its own file imports (#182)";

/** The subject: every export declared under here is judged. */
const SUBJECT_DIR = "lib/";

/** The corpus: every file that could be an importer. */
const SCAN_DIRS = ["app", "lib", "scripts", "components"];

/**
 * Repo-root files, named rather than walked. There are four and only one is
 * source; a walk of the root would pull in config that imports nothing from
 * `lib/` and would still have to be maintained, so the list is the honest form.
 */
const ROOT_FILES = ["proxy.js", "next.config.mjs", "eslint.config.mjs", "postcss.config.mjs"];

function listSources(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) listSources(full, out);
        else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** Every file in the corpus, repo-relative and POSIX-separated. */
function corpus() {
    const walked = SCAN_DIRS.flatMap((d) => listSources(join(REPO_ROOT, d))).map((abs) =>
        toPosix(relative(REPO_ROOT, abs))
    );
    return [...walked, ...ROOT_FILES.filter((f) => existsSync(join(REPO_ROOT, f)))];
}

/** Resolve a local specifier to a repo-relative path, or null. */
function resolveSpecifier(fromRel, spec) {
    const base = spec.startsWith("@/")
        ? join(REPO_ROOT, spec.slice(2))
        : resolve(REPO_ROOT, dirname(fromRel), spec);
    for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, "index.js")]) {
        if (!existsSync(candidate)) continue;
        try {
            if (statSync(candidate).isFile()) return toPosix(relative(REPO_ROOT, candidate));
        } catch {
            /* not a readable file — try the next shape */
        }
    }
    return null;
}

/** Every name this module exports. `default` and `*` are spelled as themselves. */
export function exportedNames(ast) {
    const names = new Set();
    for (const node of ast.body) {
        if (node.type === "ExportDefaultDeclaration") {
            names.add("default");
        } else if (node.type === "ExportAllDeclaration") {
            names.add("*");
        } else if (node.type === "ExportNamedDeclaration") {
            const d = node.declaration;
            if (d?.type === "VariableDeclaration") {
                for (const decl of d.declarations) if (decl.id?.type === "Identifier") names.add(decl.id.name);
            } else if (d?.id?.name) {
                names.add(d.id.name);
            }
            for (const s of node.specifiers) if (s.exported?.name) names.add(s.exported.name);
        }
    }
    return names;
}

/**
 * Every `(target, name)` this module imports, as `path::name`.
 *
 * A namespace import (`import * as m from "./x"`) reaches every name the target
 * has, so it is recorded against a wildcard and treated as importing all of them
 * — otherwise a module read that way would report its whole surface as unread.
 */
export function importedPairs(fromRel, ast) {
    const pairs = new Set();
    walk(ast, (n) => {
        const isImportish =
            n.type === "ImportDeclaration" ||
            n.type === "ExportNamedDeclaration" ||
            n.type === "ExportAllDeclaration";
        const src = isImportish && n.source?.value;
        if (typeof src !== "string" || !(src.startsWith(".") || src.startsWith("@/"))) return;
        const target = resolveSpecifier(fromRel, src);
        if (!target) return;
        const specs = n.specifiers || [];
        if (n.type === "ExportAllDeclaration" || specs.length === 0) {
            pairs.add(`${target}::*`);
            return;
        }
        for (const s of specs) {
            if (s.type === "ImportDefaultSpecifier") pairs.add(`${target}::default`);
            else if (s.type === "ImportNamespaceSpecifier") pairs.add(`${target}::*`);
            else if (s.type === "ImportSpecifier") pairs.add(`${target}::${s.imported.name}`);
            else if (s.type === "ExportSpecifier") pairs.add(`${target}::${s.local.name}`);
        }
    });
    return pairs;
}

export async function run({ check, log, assert }) {
    const files = corpus();

    const asts = new Map();
    for (const rel of files) {
        try {
            asts.set(rel, parseFile(rel).ast);
        } catch (err) {
            assert(`${rel} parses (an unparsed file is an unchecked file): ${err.message}`, false);
        }
    }

    // ── anti-vacuity, first ──────────────────────────────────────────────────
    // Every assertion below is "no X", which is also what a broken walk, a broken
    // resolver and a broken export reader each report. So each mechanism is seen
    // to work on a case whose answer is known, BEFORE any absence is claimed.
    log("the corpus, the resolver and both readers are seen to work:");
    assert(`parsed ${asts.size} files across ${SCAN_DIRS.join("/")} + the repo root`, asts.size > 150);
    assert("  the repo-root source file is in the corpus", asts.has("proxy.js"));
    const subjects = [...asts.keys()].filter((r) => r.startsWith(SUBJECT_DIR));
    assert(`  ${subjects.length} files under ${SUBJECT_DIR} are the subject`, subjects.length > 40);

    assert(
        "  the resolver follows an @/-aliased specifier",
        resolveSpecifier("app/pos/POListClient.js", "@/lib/format") === "lib/format.js"
    );
    assert(
        "  and a relative one",
        resolveSpecifier("lib/materialsCache.js", "./materialIdentity") === "lib/materialIdentity.js"
    );
    assert("  and answers null for a specifier that resolves to nothing", resolveSpecifier("lib/x.js", "./nope") === null);

    const knownExporter = "lib/uploadLimit.js";
    assert(`  the export reader finds a known export in ${knownExporter}`, exportedNames(asts.get(knownExporter)).has("MAX_UPLOAD_BYTES"));
    const knownImporter = "app/api/invoices/upload/route.js";
    assert(
        `  the import reader finds ${knownImporter} importing it`,
        importedPairs(knownImporter, asts.get(knownImporter)).has("lib/uploadLimit.js::MAX_UPLOAD_BYTES")
    );

    // ── the import census ────────────────────────────────────────────────────
    // `path::name` for a named import, `path::*` for a namespace or bare one.
    const imported = new Set();
    const importerOf = new Map();
    for (const [rel, ast] of asts) {
        for (const pair of importedPairs(rel, ast)) {
            const target = pair.slice(0, pair.lastIndexOf("::"));
            // A file importing from ITSELF is not a reader of its own export.
            if (target === rel) continue;
            imported.add(pair);
            if (!importerOf.has(pair)) importerOf.set(pair, []);
            importerOf.get(pair).push(rel);
        }
    }
    assert("the census found imports at all", imported.size > 200);

    // ── the claim ────────────────────────────────────────────────────────────
    log("");
    log(`every export under ${SUBJECT_DIR} has an importer outside its own file:`);
    const unread = [];
    let judged = 0;
    for (const rel of subjects) {
        const namespaced = imported.has(`${rel}::*`);
        for (const name of exportedNames(asts.get(rel))) {
            if (name === "*") continue;
            judged += 1;
            if (namespaced) continue;
            if (imported.has(`${rel}::${name}`)) continue;
            unread.push(`${rel} -> ${name}`);
        }
    }
    log(`  ${judged} exports judged`);
    assert("  and there were exports to judge", judged > 100);
    check(
        "no export nothing outside its own file imports — drop the `export` keyword, or give it a caller",
        unread.length === 0 ? "none" : unread.join(", "),
        "none"
    );

    // ── anti-vacuity for the claim itself ────────────────────────────────────
    // "No unread export" is also what a census that found everything imported
    // would say, so the judgment is shown to be able to answer YES: a name that
    // is exported and imported passes, and a name that is exported and not
    // imported is caught. Planted against the real census rather than a fixture.
    log("");
    log("the judgment is seen to separate the two answers:");
    assert(
        "  a genuinely imported export is not reported",
        imported.has("lib/uploadLimit.js::MAX_UPLOAD_BYTES")
    );
    const planted = "lib/uploadLimit.js::__anExportNobodyImports";
    assert("  and a name nobody imports is absent from the census", !imported.has(planted));
    // The eight this issue found are the positive cases, and they are gone as
    // exports rather than excused — so the check is asserted against what they
    // BECAME: each name still exists in its file and is no longer exported.
    for (const [file, name] of [
        ["lib/session.js", "sessionOptions"],
        ["lib/userName.js", "NAME_PATH"],
        ["lib/prSigning.js", "REQUESTER_STEP"],
    ]) {
        assert(`  ${name} is no longer exported from ${file}`, !exportedNames(asts.get(file)).has(name));
    }
}

if (isMain(import.meta.url)) await standalone(title, run);
