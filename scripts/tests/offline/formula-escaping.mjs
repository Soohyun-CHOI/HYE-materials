// Every filterByFormula interpolation goes through formulaString (#159).
//
// FAIL-CLOSED, in the shape authz-structure.mjs set: this does not hunt for
// known-bad call sites, it enumerates every `filterByFormula` in lib/ and app/
// and requires each interpolated expression to be either escaped or listed as an
// exemption with a reason. A new lookup written next month is covered without
// anyone remembering to register it, and an interpolation nobody thought about
// fails rather than passing by not being looked for.
//
// The two halves it proves:
//   1. Behaviour of the escape itself — formulaString is pure and imports
//      nothing, so its actual output is pinned here, including the replace order
//      and the hostile inputs measured against the live parser in #159.
//   2. Shape of every call site — parsed, not text-matched.
//
// WHAT THIS DOES NOT PROVE. Read this before treating a pass as safety:
//   - Source shape is not execution. It proves the TEXT at a call site wraps the
//     value in formulaString, not that the value which reached Airtable was
//     escaped. `formulaString(mangle(v))` passes. A value transformed before the
//     call passes.
//   - It cannot judge whether the escape is SUFFICIENT. Two characters being the
//     complete set for Airtable's double-quoted literal is a property of
//     Airtable's parser, not of this repo, and only a credentialed run against
//     the live base can test it — scripts/tests/verify-formula-escaping-159.mjs.
//     This file pins what formulaString does; that one pins that it is enough.
//   - An exemption is checked by NAME only. `PO_WITHDRAWN_STATUS` is on the list
//     because it is a module constant, but nothing here verifies that the
//     binding is really a const, or that nothing reassigns it. Same weakness
//     #147 recorded for its own exemptions: an exemption is worth less than a
//     wrapper, so the list is meant to stay short.
//   - Scope is lib/ and app/ only. scripts/ is excluded, and the basis is the
//     provenance of the values that are actually there rather than "a developer
//     typed them" (#159 checked, and none of them is a typed argument):
//       * scripts/demo/ and scripts/import/ build NO formula at all. The Python
//         importers query Airtable with fields[]/pageSize/offset and no filter,
//         and dedupe in Python. make-invoice-pdf.mjs takes a PO ID from argv but
//         hands it to getPOById, which escapes — it builds no formula itself.
//       * The only formulas under scripts/ are five in scripts/tests/, and every
//         interpolated value originates INSIDE the script: a token the script
//         itself just created (test-auth-tokens.js), a literal fixture key
//         (test-phase0.js), or an already-escaped value
//         (verify-materials-cache-18.mjs). No process.argv reaches any of them.
//     So there is presently nothing here to catch. It is still a real limit: an
//     unescaped interpolation in a NEW script will not be caught, and if a script
//     ever interpolates a value read from a file or from Airtable, that is a
//     different case from any of the above and the scope should be revisited.
//   - Only `filterByFormula` is inspected. No other Airtable option takes a
//     formula today.

import { andSearchAll, formulaString, orByField, orByRecordId, prefixMatch } from "../../../lib/airtableFormula.js";
import { isMain, standalone } from "./_harness.mjs";
import { listJsFiles, parseFile, repoPath, toPosix, REPO_ROOT, walk } from "./_ast.mjs";

export const title = "filterByFormula escaping — every interpolation (#159)";

const SEARCH_DIRS = ["lib", "app"];

/**
 * Interpolations allowed WITHOUT formulaString, each with the reason. Keyed by
 * the exact source text of the interpolated expression.
 *
 * Every entry is a precedent the next author can copy, so the bar is "no
 * user-supplied value can reach this", not "this looked safe to me".
 */
const ALLOWED_RAW = {
    PO_NOT_WITHDRAWN:
        'module constant in purchaseOrders.js — the fragment `{Status} != "Withdrawn"`, ' +
        "built from PO_WITHDRAWN_STATUS, the Airtable select option's own name; no " +
        "caller supplies it and no user input reaches it. REPLACED the narrower " +
        "PO_WITHDRAWN_STATUS entry in #168, which moved that interpolation into this " +
        "one shared fragment so the two invoice-side readers cannot answer differently " +
        "about the same PO. The list stays at one entry rather than gaining a second",
};

/** The canonical module. A local helper of the same name must not satisfy this. */
const CANONICAL_IMPORT = /(\.\.\/)+airtableFormula|@\/lib\/airtableFormula|\.\/airtableFormula/;

function sourceOf(source, node) {
    return source.slice(node.start, node.end);
}

/**
 * The escape boundaries this check accepts, all exported from
 * lib/airtableFormula.js.
 *
 * `formulaString` escapes ONE value. The two OR-list builders exist because a
 * batched read interpolates a joined LIST, and a `chunk.map(...).join()` at the
 * call site is invisible to this check — it would fail closed, correctly, since
 * the AST cannot see whether anything inside was escaped (#19 hit exactly that).
 * Moving the list-building next to the escape makes it one audited
 * implementation instead of a per-call-site exemption saying "trust the code
 * inside", which is the weak shape #147 warned about.
 *
 * Adding a name here widens what passes, so each must be a function whose entire
 * job is escaping, living in that module, with its own behavioural cases below.
 */
const ESCAPE_BUILDERS = new Set(["formulaString", "orByRecordId", "orByField", "andSearchAll", "prefixMatch"]);

/**
 * Builders that return a COMPLETE formula, so a bare call to one is an accepted
 * value for filterByFormula on its own — no template literal involved.
 *
 * This is stronger than the template-literal form, not weaker: there the check
 * verifies each hole is escaped and takes the surrounding text on trust, whereas
 * here the entire string comes from the audited module. formulaString is
 * deliberately absent — it escapes a value, it does not produce a predicate.
 */
const WHOLE_FORMULA_BUILDERS = new Set(["orByRecordId", "orByField", "andSearchAll", "prefixMatch"]);

function isEscapeBuilderCall(node) {
    return (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        ESCAPE_BUILDERS.has(node.callee.name)
    );
}

/** Every filterByFormula property in one parsed file. */
function findFilterProperties({ ast, source }) {
    const found = [];
    walk(ast, (node) => {
        if (node.type !== "Property") return;
        const key = node.key;
        const name = key?.type === "Identifier" ? key.name : key?.type === "Literal" ? key.value : null;
        if (name !== "filterByFormula") return;
        found.push({ node, value: node.value, text: sourceOf(source, node.value) });
    });
    return found;
}

function importsCanonicalFormulaString({ ast, source }) {
    let ok = false;
    walk(ast, (node) => {
        if (node.type !== "ImportDeclaration") return;
        if (!CANONICAL_IMPORT.test(node.source.value)) return;
        for (const spec of node.specifiers) {
            if (spec.type === "ImportSpecifier" && ESCAPE_BUILDERS.has(spec.imported.name)) ok = true;
        }
    });
    return ok;
}

export function run({ check, log, assert }) {
    // --- Part 1: the escape's own behaviour ------------------------------
    log("the escape itself (pure, so pinnable here):");
    check("a double quote is escaped", formulaString('2"'), '2\\"');
    check("a backslash is escaped", formulaString("a\\b"), "a\\\\b");
    // Order matters and is the one way to get this wrong: quote-first would let
    // the backslash pass re-escape the backslashes it just added, yielding
    // `a\\"b` — a literal backslash followed by a LIVE terminator.
    check("backslash runs first, so its own output is not re-escaped", formulaString('a"b'), 'a\\"b');
    check("a value that is only a quote", formulaString('"'), '\\"');
    check("backslash before a quote keeps both", formulaString('a\\"b'), 'a\\\\\\"b');
    check("nullish becomes an empty string", formulaString(undefined), "");
    check("null becomes an empty string, not the word", formulaString(null), "");
    check("a number is stringified", formulaString(42), "42");

    log("");
    log("the hostile values #159 measured against the live parser — all inert:");
    // Each of these was run read-only against the base and matched nothing.
    // Pinned here so a change to the escape has to break a named case.
    check(
        "the tautology loses its quotes",
        formulaString('" & {Vendor Name} & "'),
        '\\" & {Vendor Name} & \\"'
    );
    check("formula code is defanged", formulaString('IF(1, "x", "y")'), 'IF(1, \\"x\\", \\"y\\")');
    // Not escaped, and measured not to need it: inside a double-quoted literal
    // these are ordinary characters. Recorded as cases so "why isn't this
    // escaped" has an answer.
    check("a field reference is left alone (inert inside a literal)", formulaString("{Token}"), "{Token}");
    check("a single quote is left alone", formulaString("it's"), "it's");
    check("an ampersand is left alone", formulaString("a & b"), "a & b");
    check("a real newline is left alone", formulaString("a\nb"), "a\nb");

    log("");
    log("the OR-list builders — one audited boundary, not a per-site exemption:");
    check(
        "orByRecordId wraps and escapes every id",
        orByRecordId(["recA", 'rec"B']),
        'OR(RECORD_ID() = "recA", RECORD_ID() = "rec\\"B")'
    );
    // An empty list must match NOTHING rather than everything: Airtable rejects a
    // bare OR(), and a caller with no ids wants no rows, not the whole table.
    check("an empty id list matches nothing", orByRecordId([]), "FALSE()");
    check("nullish ids are dropped", orByRecordId(["recA", null, undefined]), 'OR(RECORD_ID() = "recA")');
    check(
        "orByField escapes each value and keeps the field a reference",
        orByField("Material Record ID", ["recA", 'a"b']),
        'OR({Material Record ID} = "recA", {Material Record ID} = "a\\"b")'
    );
    check("an empty value list matches nothing", orByField("F", []), "FALSE()");
    // The field name is a {reference}, not a string literal, so escaping it would
    // be wrong. It is always our own constant, so a brace in it is a bug: the
    // builder refuses rather than emitting a formula that means something else.
    const refuses = (fn) => {
        try {
            fn();
            return "accepted";
        } catch {
            return "refused";
        }
    };
    check(
        "a field name containing a brace is refused, not escaped",
        refuses(() => orByField('F} = "x" OR {G', ["v"])),
        "refused"
    );
    check("an empty field name is refused", refuses(() => orByField("", ["v"])), "refused");
    check("a non-string field name is refused", refuses(() => orByField(null, ["v"])), "refused");
    // AND, not OR: another typed word must narrow the result, never widen it.
    check(
        "andSearchAll ANDs one SEARCH per needle",
        andSearchAll("Material Label", ["pipe", '2"']),
        'AND(SEARCH("pipe", LOWER({Material Label})), SEARCH("2\\"", LOWER({Material Label})))'
    );
    check("no needles matches nothing, not everything", andSearchAll("F", []), "FALSE()");
    check("a braced field name is refused here too", refuses(() => andSearchAll("F}{", ["v"])), "refused");

    // prefixMatch (#164) is here for the same reason the OR builders are: the ID
    // counter needs a whole predicate, and the alternative was a per-call-site
    // exemption saying "trust the code inside". Its behaviour against the live
    // parser is in verify-invoice-ids-164.mjs; scripts/tests/offline/id-sequence.mjs
    // pins what it means for the counter. These are its escaping cases.
    check(
        "prefixMatch anchors with FIND and escapes the prefix",
        prefixMatch("Invoice ID", 'HYE-INV-2608"03'),
        'FIND("HYE-INV-2608\\"03", {Invoice ID}) = 1'
    );
    // FIND("", x) = 1 for every row, so an empty prefix is the whole table — the
    // answer MATCH_NOTHING exists to avoid. It refuses instead.
    check("an empty prefix is refused, not matched against everything", refuses(() => prefixMatch("F", "")), "refused");
    check("a braced field name is refused here too", refuses(() => prefixMatch("F}{", "HYE")), "refused");

    // --- Part 2: every call site ----------------------------------------
    log("");
    log(`call sites under ${SEARCH_DIRS.join("/ and ")}/ (enumerated, fail-closed):`);

    const files = SEARCH_DIRS.flatMap((dir) => listJsFiles(repoPath(dir)));
    const relFiles = files.map((f) => toPosix(f.slice(REPO_ROOT.length + 1)));

    let totalSites = 0;
    let totalInterpolations = 0;
    const violations = [];
    const unparsed = [];
    const usedExemptions = new Set();
    const escapedSites = [];

    for (const rel of relFiles) {
        let parsed;
        try {
            parsed = parseFile(rel);
        } catch (err) {
            // An unparsed file is an unchecked file — the #147 rule.
            unparsed.push(err.message);
            continue;
        }

        const props = findFilterProperties(parsed);
        if (props.length === 0) continue;

        const fileImportsCanonical = importsCanonicalFormulaString(parsed);

        for (const prop of props) {
            totalSites++;

            // A bare call to a whole-formula builder: the entire predicate comes
            // from the audited module, so there is nothing left to inspect.
            if (
                prop.value.type === "CallExpression" &&
                prop.value.callee.type === "Identifier" &&
                WHOLE_FORMULA_BUILDERS.has(prop.value.callee.name)
            ) {
                if (!fileImportsCanonical) {
                    violations.push(
                        `${rel}: calls ${prop.value.callee.name}() but does not import it from ` +
                        `lib/airtableFormula — a local definition of that name would pass this check`
                    );
                }
                escapedSites.push(rel);
                continue;
            }

            // Anything else that is not a template literal is a shape this check
            // cannot reason about — a variable, a concatenation, an indirect
            // call. Fail rather than skip: "unrecognized" must never read as
            // "fine".
            if (prop.value.type !== "TemplateLiteral") {
                violations.push(
                    `${rel}: filterByFormula is a ${prop.value.type}, not a template literal — ` +
                    `this check cannot verify it, so it fails by default`
                );
                continue;
            }

            let usesEscape = false;
            for (const expr of prop.value.expressions) {
                totalInterpolations++;
                const text = sourceOf(parsed.source, expr);

                if (isEscapeBuilderCall(expr)) {
                    usesEscape = true;
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(ALLOWED_RAW, text)) {
                    usedExemptions.add(text);
                    continue;
                }
                violations.push(
                    `${rel}: \`\${${text}}\` is interpolated into a filterByFormula without ` +
                    `an escape builder (${[...ESCAPE_BUILDERS].join(" / ")}) and is not an exemption`
                );
            }

            if (usesEscape) {
                escapedSites.push(rel);
                if (!fileImportsCanonical) {
                    // A local function with one of those names would satisfy the
                    // shape check while escaping nothing.
                    violations.push(
                        `${rel}: uses an escape builder but does not import one from lib/airtableFormula — ` +
                        `a local definition of that name would pass this check while doing nothing`
                    );
                }
            }
        }
    }

    log(`found ${totalSites} filterByFormula sites across ${relFiles.length} files, ` +
        `${totalInterpolations} interpolated expressions`);

    assert(`every file under ${SEARCH_DIRS.join("/ and ")}/ parsed`, unparsed.length === 0);
    for (const message of unparsed) log(`    ${message}`);

    // A check that finds nothing has stopped checking. #152's lesson: the
    // failure mode to fear is green-regardless, not a false alarm.
    assert("the walk actually found filterByFormula sites (else this check is inert)", totalSites > 0);
    assert("and found interpolations to judge", totalInterpolations > 0);

    assert(
        violations.length === 0
            ? "every interpolation is escaped or exempt"
            : `${violations.length} unescaped interpolation(s):`,
        violations.length === 0
    );
    for (const v of violations) log(`    ${v}`);

    // A stale exemption is a blanket permission nobody is reading any more.
    log("");
    log("exemptions (each must still be present, or the list has rotted):");
    for (const [text, reason] of Object.entries(ALLOWED_RAW)) {
        assert(`\`${text}\` is still interpolated somewhere — ${reason}`, usedExemptions.has(text));
    }

    // The auth path is the reason this issue exists; name it so a regression
    // there fails with the right label rather than as one of N sites.
    log("");
    const authTokens = parseFile("lib/airtable/authTokens.js");
    const authProps = findFilterProperties(authTokens);
    check("authTokens.js has exactly one filterByFormula", authProps.length, 1);
    assert(
        "the public /api/auth/verify token lookup escapes its token",
        authProps.length === 1 &&
            authProps[0].value.type === "TemplateLiteral" &&
            authProps[0].value.expressions.every(isEscapeBuilderCall)
    );
    assert(
        "and imports the escape from the canonical module",
        importsCanonicalFormulaString(authTokens)
    );

    // The move out of client.js is load-bearing for this file existing at all:
    // if formulaString went back behind the env fail-fast, Part 1 above could
    // not run and only the shape half would survive.
    log("");
    const client = parseFile("lib/airtable/client.js");
    let clientExportsIt = false;
    walk(client.ast, (node) => {
        if (node.type === "FunctionDeclaration" && node.id?.name === "formulaString") clientExportsIt = true;
        if (node.type === "ExportSpecifier" && node.exported?.name === "formulaString") clientExportsIt = true;
    });
    assert(
        "formulaString is NOT also in lib/airtable/client.js (one rule, one import path)",
        clientExportsIt === false
    );
}

if (isMain(import.meta.url)) standalone(title, run);
