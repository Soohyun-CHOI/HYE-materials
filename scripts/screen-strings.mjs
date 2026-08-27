// Every string each screen renders, extracted (#288).
//
// This is the deliverable rather than a document, and the reason is measured. #288
// began by writing one inventory file per screen — the strings, the condition on
// each, the table its noun points at, what protects it — and the first five files
// came to 1,861 lines for 218 entries. Then three things were measured against them.
// Of 218 entries, 40 carried a word the vocabulary work is deciding. Of 194
// conditions, 127 said what that screen's brief already said. And of the four fields
// per entry, three were derivable from the code: only which table a noun points at
// was not. Twenty-one screens on that shape came to about 6,000 lines that a sweep
// would then make stale.
//
// So the shape inverted. This file produces the list on demand, `unfindable.md`
// records what it cannot produce, `unreachable.md` records what nobody reads, and the
// per-screen inventories are gone. The 28 facts a design actually needed out of those
// conditions went into the briefs, which is where a fact about what a screen carries
// belongs and where `offline/screen-briefs.mjs` already guards it.
//
// FIVE SHAPES WERE CLOSED HERE WHILE THAT LIST WAS BEING WRITTEN, and one question
// decided each: **did the screen call that string, or did it call something that HAS
// that string?** A screen that names a string has called it, and a name is what this
// file can see — that closed a `label:` property, a `message:` property, a string map
// or set read through a JSX child container, and a bare string const the screen
// imports by name. A screen that calls a FUNCTION has called the function, and the
// literal inside belongs to that function's own purpose: reaching it means walking
// somebody else's body and dragging their log lines out with it, which is why
// `lib/materialPriceView.js:statusTag`'s three words stayed hand work.
// `docs/briefs/strings/unfindable.md` carries that test and what each fix cost.
//
// THE COSTS, because a closed shape has one and hiding it would be the whole mistake
// this file exists against. Reading a `label:` property also collects
// `confirmIngestThenDelete`'s cleanup labels, which no reader sees — one over-reach
// per screen that uploads a file. The container rule reaches only a CHILD container,
// which is what keeps `ENTRY_TONE_CLASS` and `MODAL_BACKDROP` out; the first version
// of its pre-pass forgot the attribute skip and put CSS classes on the invoice
// detail.
//
// WHAT IT STILL CANNOT SEE is `unfindable.md`, grouped by shape, and the two worth
// repeating here are the ones no rule will ever close: a string another entry point
// authored and a screen renders (`/login` shows two, thrown in `lib/auth.js` and
// serialized by a Route Handler), and a copy constant reached only through a
// function, where the link between screen and string is a return value rather than a
// name.
//
// `--check` VERIFIES THAT LIST AND NOTHING ELSE. It asserts every string
// `unfindable.md` quotes is still absent from this file's own output, so a rule added
// here fails it — which is good news, and means an entry is stale. It caught one on
// its first run. What it cannot check is whether the list is COMPLETE: a string this
// file cannot see and nobody wrote down is invisible to both, and that gap is the
// list's own subject.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed, 2 no
// failures but a part could not run.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { listJsFiles, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./tests/offline/_ast.mjs";
import { isPageFile, routeTemplate } from "./tests/offline/_entrypoints.mjs";
import { isMain } from "./tests/offline/_harness.mjs";

const INVENTORY_DIR = "docs/briefs/strings";

/** The root layout composes every tab title, so it belongs to every screen. */
const SHARED_FILES = ["app/layout.js"];

/** Attributes whose string value a person reads. Everything else is machinery. */
const READ_ATTRS = new Set(["placeholder", "title", "alt", "aria-label", "aria-description", "label"]);

/** The constants that hold screen copy. A name, not a heuristic over values. */
const COPY_NAME = /_COPY$|_TITLE$|^PRODUCT_NAME$/;

const collapse = (s) =>
    s
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

const lineOf = (source, offset) => source.slice(0, offset).split("\n").length;

// ---------------------------------------------------------------------------
// which files a screen is made of
// ---------------------------------------------------------------------------

/** Every route the app serves, from the same derivation the briefs' names use. */
export function listRoutes() {
    return listJsFiles(repoPath("app"))
        .map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1))
        .filter(isPageFile)
        .map(routeTemplate)
        .sort();
}

const routeDir = (route) => "app" + (route === "/" ? "" : route);

/**
 * Resolve one import specifier to a repo-relative path, or null when it points
 * outside this repository (`react`, `next/*`, `@vercel/blob/client`).
 */
function resolveImport(spec, fromRel) {
    let rel;
    if (spec.startsWith("@/")) rel = spec.slice(2);
    else if (spec.startsWith("./") || spec.startsWith("../")) rel = toPosix(join(dirname(fromRel), spec));
    else return null;
    // `.js` only. `app/layout.js` imports `./globals.css` for its side effect, and a
    // stylesheet handed to a JavaScript parser is an unparsed-file report on every
    // screen in the app.
    for (const candidate of [`${rel}.js`, `${rel}/index.js`, rel]) {
        if (!candidate.endsWith(".js")) continue;
        if (existsSync(repoPath(candidate)) && statSync(repoPath(candidate)).isFile()) return candidate;
    }
    return null;
}

/**
 * The files one screen is assembled from, and how much of each one counts.
 *
 * Its own directory's files, the shared layout, and every COMPONENT those reach —
 * stopping at another screen's directory, which is what keeps `/invoices` from
 * swallowing `/invoices/new`. A component renders its own text, so all of it counts,
 * and `components/ConfirmDialog.js` is why: two of this app's dialog labels exist
 * only as its default parameters.
 *
 * A `lib/` MODULE COUNTS ONLY FOR THE NAMES THIS SCREEN IMPORTS FROM IT, and that is
 * a correction rather than a refinement. Attributing the module whole put five of
 * `/login/confirm`'s sentences on `/login`, which imports one number from that file;
 * on `/invoices/new` it put `lib/poSend.js`'s forty strings on a screen that renders
 * none of them, reached three imports deep from `isPOWithdrawn`. So the copy a screen
 * gets credit for is the copy it names, and `lib` is not followed further: a constant
 * lives in the module it is named for, and reaching one through a predicate's import
 * is not rendering it.
 */
export function filesForRoute(route) {
    const dir = routeDir(route);
    const own = readdirSync(repoPath(dir))
        .filter((f) => f.endsWith(".js"))
        .map((f) => `${dir}/${f}`);
    /** relPath -> Set of imported names, or "*" for a file counted whole. */
    const scope = new Map();
    for (const rel of [...own, ...SHARED_FILES]) scope.set(rel, "*");
    const queue = [...scope.keys()];

    while (queue.length) {
        const rel = queue.shift();
        let ast;
        try {
            ({ ast } = parseSource(readFileSync(repoPath(rel), "utf8"), rel));
        } catch {
            continue;
        }
        for (const node of ast.body) {
            if (node.type !== "ImportDeclaration") continue;
            const target = resolveImport(node.source.value, rel);
            if (!target) continue;
            // AN EXPLICIT IMPORT IS A DEPENDENCY, whatever directory it lands in, and
            // refusing to cross a route boundary here was wrong. `/invoices/[invoiceId]
            // /edit` renders eight refusals from `../actions.js`, which lives in the
            // PARENT route's directory: the boundary hid every one of them. What the
            // boundary is for is containment — a screen's own file set is its directory
            // read non-recursively, so a child route's files are never swept in — and
            // that is a different question from what a file asks for by name.
            const names = node.specifiers
                .filter((s) => s.type === "ImportSpecifier")
                .map((s) => s.imported?.name)
                .filter(Boolean);
            if (target.startsWith("lib/")) {
                const existing = scope.get(target);
                if (existing === "*") continue;
                const merged = new Set(existing ?? []);
                names.forEach((n) => merged.add(n));
                scope.set(target, merged);
                continue; // not followed further — see the note above
            }
            if (scope.get(target) === "*") continue;
            scope.set(target, "*");
            queue.push(target);
        }
    }
    return scope;
}

// ---------------------------------------------------------------------------
// what counts as a string
// ---------------------------------------------------------------------------

const isStr = (n) => n?.type === "Literal" && typeof n.value === "string";

/**
 * Which MEMBERS of each copy constant one file reaches — `VARIANCE_COPY` →
 * `{headerBeforeSaving}`, and `"*"` where the access is computed.
 *
 * WHY THE CONSTANT AS A WHOLE IS THE WRONG UNIT, measured on `/invoices/new`:
 * attributing every string in a constant a screen imports put `lib/variance.js`'s
 * three other sentences and `lib/directPurchase.js`'s whole `/prs` strip on a screen
 * that renders one member of each — 33 strings, all of them somebody else's. A screen
 * renders what it names.
 */
function membersReached(ast) {
    const reached = new Map();
    const note = (name, prop) => {
        if (!COPY_NAME.test(name)) return;
        const current = reached.get(name);
        if (current === "*") return;
        if (prop === "*") return reached.set(name, "*");
        reached.set(name, new Set([...(current ?? []), prop]));
    };
    walk(ast, (n) => {
        if (n.type !== "MemberExpression" || n.object?.type !== "Identifier") return;
        if (n.computed) note(n.object.name, isStr(n.property) ? n.property.value : "*");
        else note(n.object.name, n.property?.name);
    });
    // A bare reference with no member access at all — passed on whole, so all of it.
    walk(ast, (n) => {
        if (n.type !== "ImportSpecifier") return;
        const name = n.imported?.name;
        if (COPY_NAME.test(name ?? "") && !reached.has(name)) reached.set(name, "*");
    });
    return reached;
}

/** A `key` or `tone` property's value: a closed vocabulary, never a sentence. */
const isSwitchProperty = (node, key) =>
    node.type === "Property" &&
    key === "value" &&
    (node.key?.name === "key" || node.key?.value === "key" || node.key?.name === "tone");

/**
 * Every string one file can put in front of a reader.
 *
 * JSX is walked with its position in mind rather than flatly: a container that is a
 * child of an element carries text, and one that is an `onChange` handler does not.
 * That distinction is the whole of what #254's census lacked.
 */
export function stringsInFile(relPath, allowed = "*", members = new Map()) {
    const source = readFileSync(repoPath(relPath), "utf8");
    let ast;
    try {
        ({ ast } = parseSource(source, relPath));
    } catch (err) {
        return { strings: [], error: err.message };
    }
    const out = [];
    const add = (text, node, shape, cls = "read") => {
        const value = collapse(text);
        if (!value || !/[A-Za-z]/.test(value)) return;
        out.push({ text: value, file: relPath, line: lineOf(source, node.start), shape, cls });
    };

    // Strings anywhere inside one expression: both arms of a ternary, every chunk of
    // a template, a concatenation's operands.
    //
    // TWO THINGS IT MUST NOT COLLECT, both found by running it against a hand count of
    // `/login` (#288). A nested JSX element inside a container is reached by the outer
    // walk already, so descending into it here collected a `className` — the one class
    // of string this whole file is supposed to exclude. And a literal that is an
    // operand of `===` is a state name being compared, not text being rendered:
    // `{status === "error" && …}` reported `error` as copy. Both are excluded by
    // structure rather than by a list of words.
    const COMPARISONS = new Set(["===", "!==", "==", "!="]);
    const inExpression = (node, shape) => {
        descend(
            node,
            (n) => {
                if (isStr(n)) add(n.value, n, shape);
                else if (n.type === "TemplateElement") add(n.value.cooked ?? "", n, shape);
            },
            (n, key) =>
                n.type === "JSXElement" ||
                n.type === "JSXFragment" ||
                isSwitchProperty(n, key) ||
                (n.type === "Property" && key === "key" && !n.computed) ||
                (n.type === "BinaryExpression" &&
                    COMPARISONS.has(n.operator) &&
                    (key === "left" || key === "right"))
        );
    };

    function descend(node, visit, skip = () => false) {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            node.forEach((n) => descend(n, visit, skip));
            return;
        }
        if (typeof node.type !== "string") return;
        visit(node);
        for (const key of Object.keys(node)) {
            if (key === "start" || key === "end" || key === "loc" || key === "range") continue;
            if (skip(node, key)) continue;
            descend(node[key], visit, skip);
        }
    }

    /**
     * The closed vocabulary inside one copy constant: its `key` and `tone` values, and
     * its QUOTED PROPERTY NAMES — `STATUS_COPY` keys its builders
     * `"awaiting-delivery"` and `"partly-invoiced"`, which read as seven sentences on
     * the invoice detail until they were told apart from text.
     *
     * SCOPED TO A COPY CONSTANT, not to every object in the file, and that boundary was
     * forced too: a quoted property name is a vocabulary only where it keys copy, and
     * the first version put `Content-Type` on two screens.
     */
    function switchesIn(root) {
        descend(root, (n) => {
            if (n.type !== "Property" || n.computed) return;
            if ((n.key?.name === "key" || n.key?.value === "key" || n.key?.name === "tone") && isStr(n.value))
                add(n.value.value, n.value, "key property", "switch");
            if (isStr(n.key)) add(n.key.value, n.key, "property name", "switch");
        });
    }

    const skip = (node, key) => {
        if (isSwitchProperty(node, key)) return true;
        // A property's own name, quoted or not — collected as `switch` above.
        if (node.type === "Property" && key === "key" && !node.computed) return true;
        // An attribute's own value is handled by its JSXAttribute case; descending
        // into it again would collect every className and href.
        return node.type === "JSXAttribute" && key === "value";
    };

    const visitAll = (n) => {
        switch (n.type) {
                case "JSXText":
                    add(n.value, n, "JSXText");
                    break;
                case "JSXExpressionContainer":
                    // Only a container in child position, or on an attribute a person
                    // reads. An attribute's container is reached through JSXAttribute
                    // below, so anything arriving here is a child.
                    inExpression(n.expression, "JSX expression container");
                    break;
                case "JSXAttribute": {
                    const name = n.name?.name;
                    if (!READ_ATTRS.has(name)) break;
                    if (isStr(n.value)) add(n.value.value, n.value, `${name} attribute`);
                    else if (n.value?.type === "JSXExpressionContainer")
                        inExpression(n.value.expression, `${name} attribute`);
                    break;
                }
                case "NewExpression":
                    if (n.callee?.name === "Error") inExpression(n.arguments?.[0], "thrown message");
                    break;
                case "Property":
                    // A refusal a Server Action hands back, `metadata.title`, and a
                    // `label` — which is a person's word wherever it appears, on a JSX
                    // attribute or on an object. The invoice detail's totals footer is
                    // five strings under `label:` in an array and the new-invoice form's
                    // two tab names are two more, and every one was hand work until this
                    // clause read the property the same way the attribute rule already
                    // read the attribute.
                    if (
                        n.key?.name === "error" ||
                        n.key?.name === "title" ||
                        n.key?.name === "default" ||
                        n.key?.name === "label" ||
                        n.key?.name === "message"
                    )
                        inExpression(n.value, `${n.key.name} property`);
                    break;
                case "VariableDeclarator":
                    if (COPY_NAME.test(n.id?.name ?? "")) {
                        inExpression(n.init, `${n.id.name}`);
                        switchesIn(n.init);
                    }
                    break;
                case "AssignmentPattern":
                    // A shared component's default label: `confirmLabel = "Continue"`.
                    if (isStr(n.right)) add(n.right.value, n.right, "default parameter");
                    break;
                case "BinaryExpression":
                    // THE SECOND CLASS, and #274 is why it is counted rather than
                    // dropped: `billed-more` and three siblings were `key` values, which
                    // the copy walker skips by structure and the identifier walk never
                    // visits, so four uses of a barred word were invisible to every
                    // matcher at once. A closed vocabulary reaches a reader through
                    // nothing and reaches a sweep through this.
                    if (!COMPARISONS.has(n.operator)) break;
                    // `typeof x === "string"` names a JavaScript type, not a vocabulary.
                    if ([n.left, n.right].some((s) => s?.type === "UnaryExpression" && s.operator === "typeof"))
                        break;
                    for (const side of [n.left, n.right])
                        if (isStr(side)) add(side.value, side, `${n.operator} operand`, "switch");
                    break;
            default:
                break;
        }
    };

    /**
     * A MODULE-LEVEL STRING MAP READ THROUGH A JSX CHILD CONTAINER is copy, whatever
     * it is called.
     *
     * `DONE_MESSAGES` holds the invoice detail's three confirmation banners and was
     * invisible to every rule here, because it is not named `*_COPY` and its member is
     * computed. Widening the name test would have fixed that one map and left the next
     * differently-named one invisible — the same weakness `offline/mail-money.mjs`
     * records about itself — so the signal is structural instead: the identifier has to
     * be read inside a container in CHILD position, which `skip` already separates from
     * an attribute's. That is what keeps `ENTRY_TONE_CLASS` and `MODAL_BACKDROP` out:
     * both are read into `className`, and a className is the one string this file
     * exists to exclude. Module level only, so a local object cannot be swept in.
     */
    const readByJsx = new Set();
    if (allowed === "*")
        descend(
            ast,
            (n) => {
                if (n.type !== "JSXExpressionContainer") return;
                // The inner walk takes `skip` too. Without it a container holding a
                // nested element reached that element's `className`, which put
                // `ENTRY_TONE_CLASS` and its CSS classes on the invoice detail.
                descend(
                    n.expression,
                    (m) => {
                        if (m.type === "Identifier") readByJsx.add(m.name);
                    },
                    skip
                );
            },
            skip
        );

    const moduleLevelDeclarators = () =>
        ast.body.flatMap((stmt) =>
            stmt.type === "VariableDeclaration"
                ? stmt.declarations
                : stmt.type === "ExportNamedDeclaration" && stmt.declaration?.type === "VariableDeclaration"
                  ? stmt.declaration.declarations
                  : []
        );

    if (allowed === "*") {
        descend(ast, visitAll, skip);
        for (const d of moduleLevelDeclarators()) {
            const name = d.id?.name;
            if (!name || COPY_NAME.test(name)) continue;
            // An ARRAY counts as well as an object, and the array case was the one
            // found by reading rather than predicted: `CONFIRMATION_TYPES` is
            // `["Approval", "Agreement"]` mapped into two buttons on `/prs/new`, and
            // each `STATUSES` is a filter's options. A screen that maps a list into JSX
            // has named every member of it.
            if (!readByJsx.has(name)) continue;
            if (d.init?.type !== "ObjectExpression" && d.init?.type !== "ArrayExpression") continue;
            inExpression(d.init, `${name}, a string set read through a container`);
            switchesIn(d.init);
        }
    }
    else
        descend(
            ast,
            (n) => {
                // A COPY CONSTANT, not any named export. `actions.js` imports `TABLES`
                // from `lib/airtable/client.js`, and collecting every declarator this
                // screen names put eleven Airtable table names in its inventory.
                //
                // OR A BARE STRING CONST THE SCREEN IMPORTS BY NAME, whatever it is
                // called. `lib/authTokenState.js:REQUEST_NEW_LINK` is one sentence on
                // `/login/confirm` and the name test alone skipped it. **The signal is
                // the import, not the spelling** — a screen that names a string has
                // called that string. `TABLES` stays out because it is an object, and a
                // number like `TOKEN_TTL_MINUTES` because it is not a string.
                if (n.type !== "VariableDeclarator") return;
                const named = n.id?.name;
                if (!named || !allowed.has(named)) return;
                const bareString = isStr(n.init) || n.init?.type === "TemplateLiteral";
                if (!COPY_NAME.test(named) && !bareString) return;
                const wanted = members.get(n.id.name) ?? "*";
                const roots =
                    wanted === "*" || n.init?.type !== "ObjectExpression"
                        ? [n.init]
                        : n.init.properties
                              .filter((p) => wanted.has(p.key?.name ?? p.key?.value))
                              .map((p) => p.value);
                for (const root of roots) {
                    inExpression(root, n.id.name);
                    switchesIn(root);
                }
            },
            skip
        );

    // One text can be reached twice — a container inside a `*_COPY` member, say. The
    // first sighting keeps its line.
    const byText = new Map();
    for (const s of out) if (!byText.has(s.text)) byText.set(s.text, s);
    return { strings: [...byText.values()], error: null };
}

export function stringsForRoute(route) {
    const scope = filesForRoute(route);
    const files = [...scope.keys()].sort();
    const errors = [];

    // Which members of each copy constant this screen reaches. Read from the screen's
    // own files AND from the module holding the constant, because a sibling function
    // can be the only reader: `poOptionLabel` is what renders `UNSIGNED_COPY.option`,
    // and the screen names the function rather than the member.
    const members = new Map();
    for (const rel of files) {
        try {
            const { ast } = parseSource(readFileSync(repoPath(rel), "utf8"), rel);
            for (const [name, reached] of membersReached(ast)) {
                const current = members.get(name);
                if (current === "*" || reached === "*") members.set(name, "*");
                else members.set(name, new Set([...(current ?? []), ...reached]));
            }
        } catch {
            /* reported below by stringsInFile */
        }
    }

    const strings = [];
    for (const rel of files) {
        const { strings: found, error } = stringsInFile(rel, scope.get(rel), members);
        if (error) errors.push(`${rel}: ${error}`);
        strings.push(...found);
    }
    const byText = new Map();
    for (const s of strings) if (!byText.has(s.text)) byText.set(s.text, s);
    return { files, strings: [...byText.values()], errors };
}

// ---------------------------------------------------------------------------
// --check: the unfindable list against the code
// ---------------------------------------------------------------------------

/**
 * `docs/briefs/strings/unfindable.md` claims that certain strings cannot be produced
 * by this file. That is a claim about THIS FILE, so it is the one thing here that can
 * check itself: run the extractor over every screen and assert that each string the
 * list quotes is still absent.
 *
 * IT FAILS ON GOOD NEWS AS WELL AS BAD. A rule added here can make a listed string
 * findable, and then the entry is stale and has to come out — which is exactly what
 * happened five times while the list was being written. So a failure means "read the
 * list", not "something broke".
 *
 * WHAT IT DOES NOT CHECK: whether the list is COMPLETE. Nothing can — a string the
 * extractor cannot see and nobody wrote down is invisible to both. That gap is the
 * list's own subject and its opening section says so.
 */
const UNFINDABLE = `${INVENTORY_DIR}/unfindable.md`;

/** The strings the list quotes, from its tables and its bullets alike. */
export function quotedInUnfindable(text) {
    const out = [];
    for (const m of text.matchAll(/\*\*`([^`]+)`\*\*/g)) out.push(collapse(m[1]));
    for (const row of text.split(/\r?\n/)) {
        if (!row.startsWith("|")) continue;
        for (const m of row.matchAll(/`([^`]+)`/g)) {
            const s = collapse(m[1]);
            // a cell naming a module, a constant or a route is not a quoted string
            if (/^(?:app|lib|components|scripts)\//.test(s)) continue;
            if (/^[A-Z][A-Z0-9_]*$/.test(s)) continue;
            if (s.startsWith("/")) continue;
            if (/^[a-z][A-Za-z]*$/.test(s)) continue;
            out.push(s);
        }
    }
    return [...new Set(out)].filter((s) => /[A-Za-z]{4}/.test(s) && !s.includes("{"));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function reportRoute(route) {
    const { files, strings, errors } = stringsForRoute(route);
    const read = strings.filter((s) => s.cls === "read");
    const switches = strings.filter((s) => s.cls === "switch");
    console.log(
        `${route} — ${read.length} read, ${switches.length} switch, across ${files.length} files`
    );
    for (const f of files) console.log(`  file  ${f}`);
    const order = (a, b) => a.file.localeCompare(b.file) || a.line - b.line;
    console.log("");
    for (const s of read.sort(order)) console.log(`  ${s.file}:${s.line}  [${s.shape}]  ${JSON.stringify(s.text)}`);
    console.log("");
    for (const s of switches.sort(order)) console.log(`  switch  ${s.file}:${s.line}  ${JSON.stringify(s.text)}`);
    errors.forEach((e) => console.log(`  UNPARSED  ${e}`));
    return errors.length === 0 ? 0 : 2;
}

function runCheck(routes) {
    const path = repoPath(UNFINDABLE);
    if (!existsSync(path)) {
        console.log(`${UNFINDABLE} is not there, so there is nothing to check`);
        return 2;
    }
    const quoted = quotedInUnfindable(readFileSync(path, "utf8"));
    if (quoted.length === 0) {
        console.log(`${UNFINDABLE} quotes no strings — the check cannot see what it is for`);
        return 2;
    }

    // Every string every screen produces, squashed, so a run can span the chunk
    // boundary a concatenated template leaves behind.
    const parseErrors = [];
    let hay = "";
    for (const route of routes) {
        const { strings, errors } = stringsForRoute(route);
        errors.forEach((e) => parseErrors.push(`${route}: ${e}`));
        hay += strings.map((s) => s.text).join("  ") + "  ";
    }
    const squashed = hay.replace(/\s+/g, "");

    const nowFound = quoted.filter((q) => squashed.includes(q.replace(/\s+/g, "")));
    console.log(`${quoted.length} strings quoted as unfindable, across ${routes.length} screens`);
    parseErrors.forEach((e) => console.log(`  UNPARSED ${e}`));
    if (nowFound.length === 0) {
        console.log("  every one is still absent from the extractor's output");
        return parseErrors.length ? 2 : 0;
    }
    console.log(`  ${nowFound.length} the extractor NOW PRODUCES — the entry is stale and should come out:`);
    nowFound.forEach((q) => console.log(`    ${JSON.stringify(q)}`));
    return 1;
}

// BEHIND A MAIN GUARD SINCE #303, so an offline check can import the collection
// rather than write a second one. Without it, `import`ing this file ran the census
// as a side effect and printed twenty-one lines into another check's output — which
// is the same "an import is an execution" hazard CLAUDE.md records for the client
// bundle, one tier down. `offline/item-row-nouns.mjs` is the caller.
if (isMain(import.meta.url)) {
    const args = process.argv.slice(2);
    const check = args.includes("--check");
    const named = args.filter((a) => a.startsWith("/"));
    const routes = named.length ? named : listRoutes();

    if (check) process.exit(runCheck(routes));
    else if (named.length) process.exit(named.reduce((code, r) => Math.max(code, reportRoute(r)), 0));
    else {
        let total = 0;
        for (const route of routes) {
            const { files, strings } = stringsForRoute(route);
            total += strings.length;
            console.log(`${String(strings.length).padStart(4)}  ${route}  (${files.length} files)`);
        }
        // The census is recomputed rather than written down, which is
        // `airtable-ops.mjs`'s move: a number in a document goes stale unread.
        console.log(`\n${total} strings across ${routes.length} screens`);
    }
}
