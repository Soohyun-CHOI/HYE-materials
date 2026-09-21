// Every credentialed script opens with its provenance (#172).
//
// `scripts/tests/_provenance.mjs` prints the commit a run happened at and what
// the tree looked like, so a result pasted somewhere can still be tied to code
// afterwards. That is worth nothing as a convention: seven scripts had written
// their own copy and the rest printed nothing, which is the state this check
// exists to stop returning to. A script added next week forgets, and the way you
// find out is that a run six months later cannot be placed.
//
// WHAT IT ASKS, AND WHAT IT DOES NOT. That each `verify-*.mjs` imports the helper
// and calls it. Not WHERE in the file the call sits, and not that it runs — this
// tier never executes a credentialed script, so "the header is the first thing
// printed" is beyond it, the same limit `source-shape.mjs` states about order. A
// call placed after a hundred lines of output would pass here and be wrong; what
// stops that is the reviewer, and the call is one line in a file whose first
// statement it conventionally is.
//
// THE DIRECTORY IS WALKED RATHER THAN LISTED, which is the whole point: a
// hard-coded inventory cannot see a file added after it was written, and this
// check's subject is precisely the script nobody remembered. Same reasoning as
// the offline runner's own directory scan and #147's enumerated endpoint list.
//
// The three-line walk is duplicated from `offline/fixture-cleanup.mjs`, which
// enumerates the same directory for a different question. Deliberately not
// extracted: `_entrypoints.mjs` (#224) was worth pulling out because it carried a
// real mechanism two checks had to agree on, and this is `readdirSync` plus a
// prefix test. Two copies of that drift into nothing worse than each other.

import { readdirSync } from "node:fs";
import { parseFile, parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Provenance header across the credentialed tier (#172)";

const TESTS_DIR = "scripts/tests";
const HELPER = "./_provenance.mjs";
const FUNCTION = "printProvenance";

function verifyScripts() {
    return readdirSync(repoPath(TESTS_DIR))
        .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs"))
        .sort();
}

/** Does this module import `printProvenance` from the helper, and call it? */
function provenanceUse(ast) {
    let imported = false;
    let called = false;

    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration" || node.source.value !== HELPER) continue;
        if (node.specifiers.some((s) => s.imported?.name === FUNCTION)) imported = true;
    }

    walk(ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier" && n.callee.name === FUNCTION) {
            called = true;
        }
    });

    return { imported, called };
}

export function run({ check, assert, log }) {
    const files = verifyScripts();

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // An empty walk and a clean tier print the same thing, and so do a parser
    // that returns nothing and a file that really calls the helper. Both are
    // answered before anything is claimed: the walk reaches files, and the
    // detector is seen saying yes and no on sources written here.
    log("anti-vacuity — the walk reaches files and the detector answers both ways:");
    assert(`walked ${files.length} verify-*.mjs scripts`, files.length > 10);

    const { ast: yes } = parseSource(
        `import { printProvenance } from "${HELPER}";\n${FUNCTION}({ title: "x" });\n`,
        "<synthetic-yes>"
    );
    const { ast: no } = parseSource(`import { createFixtures } from "./_fixtures.mjs";\nconsole.log("x");\n`, "<synthetic-no>");
    check("  a module that imports and calls it reads as imported", provenanceUse(yes).imported, true);
    check("    and as called", provenanceUse(yes).called, true);
    check("  one that does neither reads as not imported", provenanceUse(no).imported, false);
    check("    and as not called", provenanceUse(no).called, false);

    // A COMMENT MUST NOT SATISFY IT. The old substring checks this repository
    // replaced were satisfied by prose about the thing they looked for, so the
    // detector is shown refusing exactly that.
    const { ast: prose } = parseSource(
        `// This script should call ${FUNCTION} from "${HELPER}" and does not.\nconsole.log("x");\n`,
        "<synthetic-comment>"
    );
    check("  and a comment naming it satisfies neither", provenanceUse(prose).imported || provenanceUse(prose).called, false);

    // ── the tier ────────────────────────────────────────────────────────────
    log("");
    log("every verify-*.mjs imports the helper and calls it:");

    let missing = 0;
    for (const file of files) {
        const { ast } = parseFile(`${TESTS_DIR}/${file}`);
        const { imported, called } = provenanceUse(ast);
        if (imported && called) continue;
        missing++;
        assert(
            `  ${file} — ${imported ? "imports" : "does NOT import"} ${FUNCTION} and ${called ? "calls" : "does NOT call"} it; ` +
                `open the run with printProvenance({ title }) from ${HELPER}`,
            false
        );
    }
    check("scripts with no provenance header", missing, 0);
    log(`  ${files.length - missing} of ${files.length} carry it`);
}

if (isMain(import.meta.url)) standalone(title, run);
