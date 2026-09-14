// One rule for the name this app prints for a person, and two audiences (#381).
//
// WHAT THIS IS DEFENDING. `Users."First Name"` and `Users."Last Name"` are two
// fields, and which of them a surface prints is a judgment rather than a
// preference: a screen that merely NAMES somebody prints the first name, and two
// kinds of place print both — where a person is CHOSEN from a list, and where
// somebody outside this company reads the result. Written out at each call site
// that is twenty-odd independent decisions, and the mutant is silent in both
// directions. A picker quietly narrowed to a first name still renders, still
// reads sensibly, and routes a signing chain to the wrong Soo. A reporting
// screen quietly widened to both names still renders and nothing fails.
//
// SO THE RULE IS STRUCTURAL: nothing outside `lib/userName.js` reads either name
// field off a user, and the files allowed to print both are DECLARED in that
// module and compared against the files that actually import `fullUserName`.
// That is `offline/file-route.mjs`'s shape, and for its reason — a list that
// only described what the code does would pass whatever the code did, so the
// declaration and the imports are two places that have to agree.
//
// ASSERTION 3 IS THE #373 TRAP, one axis over. `lib/authz.js` sends a nameless
// reader to the name step, and it must reach that address through the builder
// rather than by spelling it: an assertion naming a string both sides import
// moves with a rename and says nothing. So the gate is held to the IMPORTED
// identifiers, and the literal is barred from that file outright.
//
// ASSERTION 4 IS THE SIGNAL ITSELF. A row is nameless when it is created, which
// is the whole of what makes the name step reachable — `createUser` writing a
// name again would close the step silently, with every other check still green
// and every screen still rendering.
//
// WHAT A PASS DOES NOT PROVE. That the screen renders, that the redirect fires,
// or that the base has the two fields at all — this tier never draws a page and
// never reads Airtable (`docs/notes/verification.md`). The first two are browser
// measurements recorded in the pull request; the third is what
// `offline/table-field-names.mjs` holds from the source side and what only a
// credentialed run could confirm.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { callsTo, listJsFiles, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isPageFile } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { FULL_NAME_SURFACES, fullUserName, isNameStep, judgeName, namePath, needsName, userName } from "../../../lib/userName.js";

export const title = "One rule for a person's name, and two audiences (#381)";

/** The module that owns the judgment, and the mapper that produces its input. */
const OWNER = "lib/userName.js";
const MAPPER = "lib/airtable/users.js";

/** Where a string reaches a reader, and nothing else. */
const SCANNED_DIRS = ["app", "lib"];

/** Every `.js` under app/ + lib/, repo-relative and POSIX-separated. */
function scannedFiles() {
    const root = toPosix(repoPath("."));
    return SCANNED_DIRS.flatMap((dir) =>
        listJsFiles(repoPath(dir)).map((abs) => toPosix(abs).slice(root.length + 1))
    );
}

/** Every `X.firstName` / `X.lastName` member read in a file, with its line. */
export function nameFieldReads(relPath) {
    const out = [];
    let ast, source;
    try {
        ({ ast, source } = parseFile(relPath));
    } catch {
        return out;
    }
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    walk(ast, (node) => {
        if (node.type !== "MemberExpression" || node.computed) return;
        const prop = node.property?.name;
        if (prop !== "firstName" && prop !== "lastName") return;
        out.push({ property: prop, line: lineOf(node.start) });
    });
    return out;
}

/** The names a file imports from `lib/userName.js`, by any spelling of the path. */
export function importsFromOwner(relPath) {
    const names = new Set();
    let ast;
    try {
        ({ ast } = parseFile(relPath));
    } catch {
        return names;
    }
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue;
        if (!/(^|\/)userName(\.js)?$/.test(String(node.source.value))) continue;
        for (const spec of node.specifiers) names.add(spec.imported?.name ?? spec.local.name);
    }
    return names;
}

export function run({ check, assert, log }) {
    const files = scannedFiles();

    // ── anti-vacuity, first ─────────────────────────────────────────────────
    // Every assertion below is of the form "no X" or "these two sets agree", and
    // an empty walk satisfies both. So the walk is seen to have found the tree,
    // and each detector is seen to say YES on a case where the answer is known.
    log("the walk reaches the tree and the detectors can say yes:");
    assert(`walked ${files.length} files under ${SCANNED_DIRS.join(" + ")}`, files.length > 100);
    assert(`${OWNER} is in the walk`, files.includes(OWNER));
    assert(`${MAPPER} is in the walk`, files.includes(MAPPER));

    const plantedReads = (() => {
        const { ast, source } = parseSource("const n = user.firstName + person.lastName;");
        const found = [];
        const lineOf = (o) => source.slice(0, o).split("\n").length;
        walk(ast, (node) => {
            if (node.type !== "MemberExpression" || node.computed) return;
            const p = node.property?.name;
            if (p === "firstName" || p === "lastName") found.push({ property: p, line: lineOf(node.start) });
        });
        return found;
    })();
    assert("  a planted read of either field is seen, on a snippet", plantedReads.length === 2);

    // And the two functions actually do what the split says, called rather than
    // read — which is the one thing a source-shape check can escape into behavior.
    log("");
    log("the two renderings, called:");
    const person = { firstName: "Soo", lastName: "Choi", email: "soohyun.c@x.com" };
    check("a screen naming a person gets the first name", userName(person), "Soo");
    check("a picker and a vendor get both", fullUserName(person), "Soo Choi");
    const nameless = { email: "bsws9803@x.com" };
    check("a nameless row falls back to the local part", userName(nameless), "bsws9803");
    check("  and so does the full name", fullUserName(nameless), "bsws9803");
    check("  which is what makes it nameless", needsName(nameless), true);
    check("a named row is not", needsName(person), false);
    check("whitespace is not a name", needsName({ firstName: "   " }), true);
    check("no user at all renders nothing", userName(null), "");
    check("  rather than the word undefined", fullUserName(undefined), "");
    check("a refused pair says which field", judgeName({ firstName: " ", lastName: "Choi" }).error.includes("first"), true);
    check("  and a good pair comes back trimmed", judgeName({ firstName: "  Soo  ", lastName: "Choi " }).firstName, "Soo");

    // ── 1: nothing outside the owner reads either field ─────────────────────
    log("");
    log(`only ${OWNER} reads a name field off a user:`);
    const strays = [];
    for (const rel of files) {
        if (rel === OWNER) continue;
        for (const read of nameFieldReads(rel)) strays.push({ ...read, file: rel });
    }
    for (const s of strays) log(`  ${s.file}:${s.line}  reads .${s.property} directly`);
    check("files reading a name field outside it", strays.length, 0);
    // THE MAPPER NEEDS NO EXEMPTION AND THAT IS THE POINT. It writes the two
    // fields as quoted Airtable keys and produces the two properties — it never
    // READS one off a user, so the rule reaches every file in the tree with no
    // list beside it. `payloadKeysOf` below is what holds the mapper's own half.
    assert(`  ${OWNER} reads them`, nameFieldReads(OWNER).length >= 2);
    assert(`  and ${MAPPER} reads neither`, nameFieldReads(MAPPER).length === 0);

    // ── 2: the full-name inventory, declared and imported, both ways ────────
    log("");
    log("the full name is printed by exactly the declared surfaces:");
    const declared = new Set(Object.keys(FULL_NAME_SURFACES));
    assert(`${declared.size} surfaces are declared, each with a reason`, declared.size >= 3);
    assert(
        "  and every reason says something",
        Object.values(FULL_NAME_SURFACES).every((why) => typeof why === "string" && why.length > 20)
    );
    const importers = new Set(
        files.filter((rel) => rel !== OWNER && importsFromOwner(rel).has("fullUserName"))
    );
    const undeclared = [...importers].filter((rel) => !declared.has(rel));
    const unused = [...declared].filter((rel) => !importers.has(rel));
    for (const rel of undeclared) log(`  ${rel} prints a full name and is not declared`);
    for (const rel of unused) log(`  ${rel} is declared and does not print one`);
    check("surfaces printing a full name but not declared", undeclared.length, 0);
    check("surfaces declared but not printing one", unused.length, 0);
    // A DECLARED SURFACE MUST ALSO CALL IT, not merely import it — an import left
    // behind by an edit is exactly the half-removal this pairing exists to catch.
    const notCalling = [...declared].filter((rel) => {
        try {
            return callsTo(parseFile(rel).ast, "fullUserName").length === 0;
        } catch {
            return true;
        }
    });
    for (const rel of notCalling) log(`  ${rel} imports the full name and never calls it`);
    check("declared surfaces that import it without calling it", notCalling.length, 0);

    // ── 3: the gate reaches the name step through the builder ───────────────
    log("");
    log("`requireUser()` reaches the name step by the imported identifiers:");
    const authz = parseFile("lib/authz.js");
    const gateImports = importsFromOwner("lib/authz.js");
    for (const name of ["needsName", "namePath", "isNameStep"]) {
        assert(`  lib/authz.js imports ${name}`, gateImports.has(name));
        assert(`    and calls it`, callsTo(authz.ast, name).length >= 1);
    }
    // THE LITERAL IS BARRED THERE. A gate that spells the address is a gate whose
    // agreement with the builder is a coincidence, and this is the file where the
    // coincidence would survive a rename.
    const literals = [];
    walk(authz.ast, (node) => {
        if (node.type === "Literal" && typeof node.value === "string" && node.value.includes("/login/name")) {
            literals.push(node.value);
        }
    });
    check("the name step's address spelled in lib/authz.js", literals.length, 0);
    // Seen to be able to say yes, on a snippet whose answer is known.
    const probe = parseSource('redirect("/login/name");');
    const probeHits = [];
    walk(probe.ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("/login/name")) probeHits.push(n.value);
    });
    assert("  and a planted literal is caught", probeHits.length === 1);
    check("the builder answers the step's own address", isNameStep(namePath(null)), true);
    check("  and carries a destination through", namePath("/tools"), "/login/name?destination=%2Ftools");
    check("  while refusing one that points out of the app", namePath("//evil.example"), "/login/name");
    check("  and the step is not a place to land", isNameStep("/login/name?destination=/prs"), true);
    check("  where an ordinary address is not", isNameStep("/prs"), false);

    // ── 3b: every page asks, including the one that cannot use requireUser ──
    // THE GAP THIS CLOSES WAS FOUND IN A BROWSER, not here. `requireUser()` asks
    // for a name, so every page that calls it is covered by construction — but the
    // root screen resolves the session itself, because it draws a signed-OUT state
    // of its own, and a first sign-in with no destination lands exactly there. So
    // the one page outside the gate was the first page a new colleague sees.
    //
    // THE RULE IS MECHANICAL AND NEEDS NO LIST: a page that resolves a session
    // without `requireUser` must call `askForNameIfMissing`. One page does that
    // today; a second one added later fails until it asks.
    log("");
    log("every page that resolves a session asks for a name:");
    const SESSION_RESOLVERS = ["getCurrentUser", "getActiveUser"];
    const pages = files.filter((rel) => isPageFile(rel));
    assert(`${pages.length} pages are enumerated`, pages.length > 15);
    const outsideTheGate = [];
    for (const rel of pages) {
        let ast;
        try {
            ({ ast } = parseFile(rel));
        } catch {
            continue;
        }
        if (callsTo(ast, "requireUser").length > 0) continue;
        if (!SESSION_RESOLVERS.some((name) => callsTo(ast, name).length > 0)) continue;
        if (callsTo(ast, "askForNameIfMissing").length > 0) continue;
        outsideTheGate.push(rel);
    }
    for (const rel of outsideTheGate) log(`  ${rel} resolves a session and never asks`);
    check("pages resolving a session without asking for a name", outsideTheGate.length, 0);
    // Anti-vacuity: the page that takes this path is seen to, or "none outside" is
    // what a walk finding no pages at all reports.
    const selfResolving = pages.filter((rel) => {
        try {
            const { ast } = parseFile(rel);
            return (
                callsTo(ast, "requireUser").length === 0 &&
                SESSION_RESOLVERS.some((name) => callsTo(ast, name).length > 0)
            );
        } catch {
            return false;
        }
    });
    assert(
        `  ${selfResolving.length} page(s) resolve a session themselves, and each is seen`,
        selfResolving.length >= 1
    );
    assert("  and one gated page is seen to use requireUser instead", pages.some((rel) => {
        try {
            return callsTo(parseFile(rel).ast, "requireUser").length > 0;
        } catch {
            return false;
        }
    }));

    // ── 4: a row is created nameless ────────────────────────────────────────
    log("");
    log("`createUser` writes no name, which is what makes the step reachable:");
    const users = parseFile(MAPPER);
    const created = [];
    let inCreate = false;
    walk(users.ast, (node) => {
        if (node.type === "FunctionDeclaration" && node.id?.name === "createUser") inCreate = true;
    });
    assert("createUser resolves", inCreate);
    const createPayloadKeys = payloadKeysOf(users.ast, "createUser");
    for (const field of ["First Name", "Last Name"]) {
        assert(`  its payload does not carry ${JSON.stringify(field)}`, !createPayloadKeys.includes(field));
    }
    // Anti-vacuity: the payload reader is seen to read the payload it IS carrying.
    assert("  while the fields it does write are read", createPayloadKeys.includes("Is Admin"));
    // And the one writer that DOES carry them is seen to.
    const setPayloadKeys = payloadKeysOf(users.ast, "setUserName");
    for (const field of ["First Name", "Last Name"]) {
        assert(`  setUserName writes ${JSON.stringify(field)}`, setPayloadKeys.includes(field));
    }

    log("");
    log(`  ${files.length} files, ${declared.size} full-name surfaces, ${strays.length} stray reads`);
    log("  what this CANNOT say: whether a screen renders, or whether the base has the fields");
}

/**
 * Every quoted object key inside one named function — the shape an Airtable
 * write payload takes in `lib/airtable/*`.
 */
function payloadKeysOf(ast, functionName) {
    const keys = [];
    walk(ast, (node) => {
        if (node.type !== "FunctionDeclaration" || node.id?.name !== functionName) return;
        walk(node, (inner) => {
            if (inner.type !== "Property") return;
            const key = inner.key?.type === "Literal" ? inner.key.value : inner.key?.name;
            if (typeof key === "string") keys.push(key);
        });
    });
    return keys;
}

if (isMain(import.meta.url)) standalone(title, run);
