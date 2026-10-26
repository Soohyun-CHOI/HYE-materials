// Every table the base has is classified by the wipe (#358).
//
// `wipe_base.mjs` ALREADY ASKED THIS AND NOBODY HEARD IT. That script refuses to
// run when a table is in `TABLES` but in neither its delete order nor its keep
// lists — a guard written in #162, when two tables arrived at once and a wipe
// that quietly skipped them would have left exactly the rows it was run to
// remove. The guard was right and it fired: from #334, which added three tools
// tables, `wipe_base.mjs` exited 1 without deleting anything. **For twenty-odd
// issues nobody noticed, because the only way to hear a guard inside a script is
// to run the script, and this one is run about twice a year.**
//
// SO THE QUESTION MOVES TO CI, WHERE NOBODY HAS TO CHOOSE TO ASK IT. The commit
// that adds a table now fails here until its author says what a wipe should do
// with it — delete it at a depth, or keep it with a reason. That is a decision
// somebody has to make anyway; the only thing this changes is when they are
// asked, from "whenever the base is next rebuilt" to "in the commit that creates
// the table".
//
// IT CANNOT ASK WHETHER THE ANSWER IS RIGHT. A table put in the delete order at
// the wrong depth, or kept for a reason that has since lapsed, passes this
// check — the shape of every structural check in this tier, and the reason
// the lists carry their ORDER comments and two separate keep lists.
// What this holds is that no table is un-classified.
//
// THE LISTS ARE A MODULE OF THEIR OWN SINCE #575, AND THIS HOLDS THAT THEY STAY
// ONE. `scripts/demo/_wipe_tables.mjs` declares them; `wipe_base.mjs` empties by
// them and `reset_demo.mjs` names the kept tables from them. A copy declared in
// either script would be a second answer to what the wipe keeps — which is how
// `reset_demo.mjs` came to say "every table except Users" for a wipe that kept
// eight — so each must import all three and declare none.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { tableEntriesFromSource } from "./table-field-names.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The wipe classifies every table (#358), from one module (#575)";

const WIPE_TABLES = "scripts/demo/_wipe_tables.mjs";

/** The array declarations the wipe sorts tables into. */
const LISTS = ["ORDER", "KEPT", "KEPT_FOR_THEIR_LINKS"];

/** The scripts that read the lists, each by importing all three. */
const READERS = ["scripts/demo/wipe_base.mjs", "scripts/demo/reset_demo.mjs"];

/** The specifier both readers import the lists by, from beside them. */
const WIPE_TABLES_SPECIFIER = "./_wipe_tables.mjs";

/** The names a source imports from one specifier. */
function importedFrom(ast, specifier) {
    const names = [];
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration" || node.source.value !== specifier) return;
        for (const s of node.specifiers) if (s.imported?.name) names.push(s.imported.name);
    });
    return names;
}

/** Which of the list names a source declares itself, at any depth. */
function declaredLists(ast) {
    const names = [];
    walk(ast, (node) => {
        if (node.type === "VariableDeclarator" && LISTS.includes(node.id?.name)) names.push(node.id.name);
    });
    return names;
}

/**
 * The `TABLES.X` keys named inside one top-level array declaration.
 *
 * Read off the AST rather than by importing the module, for this tier's own
 * reason: `_wipe_tables.mjs` imports `lib/airtable/client.js`, which throws
 * `Missing AIRTABLE_TEST_API_KEY` at module load.
 */
function keysInList(ast, name) {
    const keys = [];
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== name || node.init?.type !== "ArrayExpression") return;
        for (const element of node.init.elements) {
            if (
                element?.type === "MemberExpression" &&
                element.object?.name === "TABLES" &&
                element.property?.type === "Identifier"
            ) {
                keys.push(element.property.name);
            }
        }
    });
    return keys;
}

export function run({ check, assert, log }) {
    const { ast } = parseFile(WIPE_TABLES);
    const entries = tableEntriesFromSource();
    const tableKeys = entries.map((e) => e.key);

    const found = {};
    for (const list of LISTS) found[list] = keysInList(ast, list);
    const classified = LISTS.flatMap((list) => found[list]);

    log("the three lists parse:");
    for (const list of LISTS) {
        log(`  ${list}: ${found[list].length} tables`);
    }

    // ANTI-VACUITY. Every assertion below is of the form "nothing is missing",
    // and a parse that found nothing reports exactly that. Both sides have to be
    // seen to have found something before "no gaps" can mean anything, and the
    // two counts come from different files by different parsers.
    log("");
    log("anti-vacuity — both sides were really read:");
    assert("TABLES was parsed and is not empty", tableKeys.length > 0);
    assert("the wipe's lists were parsed and are not empty", classified.length > 0);
    check("  every list found at least one table", LISTS.every((l) => found[l].length > 0), true);

    log("");
    log("every table is classified:");
    const missing = tableKeys.filter((key) => !classified.includes(key));
    check(
        "no table in TABLES that the wipe does not mention",
        missing.length === 0 ? "none" : missing.join(", "),
        "none"
    );

    const unknown = classified.filter((key) => !tableKeys.includes(key));
    check(
        "no table the wipe mentions that TABLES does not have",
        unknown.length === 0 ? "none" : unknown.join(", "),
        "none"
    );

    // A table in two lists is a contradiction rather than a duplicate: one of
    // them says delete and the other says keep, and which wins is the array
    // order in a `new Set`.
    const seen = new Set();
    const twice = classified.filter((key) => (seen.has(key) ? true : (seen.add(key), false)));
    check(
        "no table classified twice",
        twice.length === 0 ? "none" : [...new Set(twice)].join(", "),
        "none"
    );

    log("");
    log("the lists are one module's, read and never copied (#575):");
    check("  the module declares all three", declaredLists(ast).sort().join(", "), [...LISTS].sort().join(", "));
    for (const reader of READERS) {
        const { ast: readerAst } = parseFile(reader);
        check(`  ${reader} imports all three from ${WIPE_TABLES_SPECIFIER}`, importedFrom(readerAst, WIPE_TABLES_SPECIFIER).sort().join(", "), [...LISTS].sort().join(", "));
        check(`    and declares none of its own`, declaredLists(readerAst).join(", ") || "none", "none");
    }

    // ANTI-VACUITY for the two readers above: each finds what it looks for when it
    // is there, so "none declared" and "all imported" are answers rather than
    // the sound of a walk that matched nothing.
    const planted = (source) => parseSource(source, "planted").ast;
    check("  a planted copy of a list is found", declaredLists(planted("const KEPT = [TABLES.USERS];")).join(", "), "KEPT");
    check("  a list declared inside a block is found too", declaredLists(planted("if (x) { const ORDER = []; }")).join(", "), "ORDER");
    check(
        "  a planted import is read by its specifier",
        importedFrom(planted(`import { ORDER, KEPT as K } from "${WIPE_TABLES_SPECIFIER}";\nimport { KEPT_FOR_THEIR_LINKS } from "./other.mjs";`), WIPE_TABLES_SPECIFIER).join(", "),
        "ORDER, KEPT"
    );
}

if (isMain(import.meta.url)) standalone(title, run);
