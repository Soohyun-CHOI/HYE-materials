// The screen-string inventory's rule, executable (#288).
//
// `docs/briefs/strings/` records every string each screen can render. This is what
// counts them, and it exists for the reason `scripts/wrap-72.mjs` exists: the rule is
// mechanical, so a prose statement of it is applied at a different moment from when
// it is read, and a hand pass over 2,500 lines of JSX misses things.
//
// WHAT IT IS FOR IS MEASURING ITS OWN BLIND SPOT, not replacing the hand pass. Three
// ways of counting screen strings already existed and each missed a different shape:
// #254's census could not see inside a JSX expression container,
// `offline/line-vocabulary.mjs` reads `*_COPY` declarators and nothing else, and
// #292's `offline/mail-money.mjs` is keyed on parameter names. #288 did not merge
// them. It took two screens by hand, ran this afterwards, and reported the difference
// in both directions — because a difference of zero can mean the two passes saw the
// same thing rather than that either was complete.
//
// SO THE OUTPUT IS THREE NUMBERS AND NEVER ONE:
//
//   hand-only            what this cannot attribute. The blind spot, named.
//   tool-only, real      what the hand pass missed. The hand pass's own error bar.
//   tool-only, unrendered  what this attributed and the screen does not say. A copy
//                        module reached by an import is attributed WHOLE, so every
//                        constant a screen imports and does not render lands here.
//                        Over-reach is reported rather than filtered, because the
//                        filter would be the judgment the inventory is for.
//
// TWO LIMITS MEASURED ON `/invoices/[invoiceId]`, BOTH NAME-SHAPED, and both are the
// weakness #292's `offline/mail-money.mjs` records about itself one level over:
//
//   1. IT FINDS COPY IN A CONSTANT NAMED `*_COPY` (or `*_TITLE`, or `PRODUCT_NAME`).
//      `DONE_MESSAGES` holds that screen's three confirmation banners and is invisible
//      to every rule here. Widening `COPY_NAME` is not the fix on its own: the map is
//      also read through a computed member, so the member filter would take it whole.
//   2. IT READS A `label` JSX ATTRIBUTE AND NOT A `label` PROPERTY. The invoice
//      detail's totals footer is five strings under `label:` in an array, and all five
//      are hand work. Adding the property is one line and would also collect
//      `lib/blobIngest.js`'s cleanup labels, which no reader sees — so it is a change
//      with a measurement attached, not a tidy-up, and it belongs to the pass that can
//      re-reconcile the two hand-counted screens against it.
//
// THE SIX SHAPES IT CANNOT COUNT AT ALL are in `docs/briefs/strings/README.md`, and
// every inventory file names the ones that reach its own screen. Two are worth
// repeating here because they bound what `--check` can ever prove: a string another
// entry point authored and this screen renders (`/login` shows two, thrown in
// `lib/auth.js` and serialized by a Route Handler), and a value that lives on the
// Airtable base rather than in this repository.
//
// WHY THIS IS NOT IN `scripts/tests/offline/` YET. The check it will become asserts,
// first, that every brief has an inventory and every inventory has a brief — the
// equality `offline/screen-briefs.mjs` already makes both ways. That cannot hold
// while sixteen screens have no file, so it lands with the last group of them. What
// it will assert is what `--check` asserts here, unchanged.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed, 2 no
// failures but a part could not run.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { listJsFiles, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./tests/offline/_ast.mjs";
import { isPageFile, routeTemplate } from "./tests/offline/_entrypoints.mjs";
import { briefFileName } from "./tests/offline/screen-briefs.mjs";

const INVENTORY_DIR = "docs/briefs/strings";

/** The root layout composes every tab title, so it belongs to every screen. */
const SHARED_FILES = ["app/layout.js"];

/** Attributes whose string value a person reads. Everything else is machinery. */
const READ_ATTRS = new Set(["placeholder", "title", "alt", "aria-label", "aria-description", "label"]);

/**
 * The shortest literal run `--check` will look for in a file. Below it a run is not
 * evidence of anything — `Qty` and `PO` occur everywhere — so the entry goes
 * unverified rather than falsely confirmed, and the count of skipped ones is reported.
 */
const MIN_RUN = 8;

/** The constants that hold screen copy. A name, not a heuristic over values. */
const COPY_NAME = /_COPY$|_TITLE$|^PRODUCT_NAME$/;

const collapse = (s) =>
    s
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

/**
 * A file's text as a haystack for one sentence.
 *
 * CONCATENATION IS STITCHED, and without that the assertion is a false alarm on every
 * long constant in `lib/`: `DIRECT_PURCHASE_COPY.modal.summary` is five string
 * literals joined by `+`, so the sentence a reader sees exists in no single literal
 * and a search for it fails while nothing is wrong.
 */
const codeHaystack = (s) => collapse(s.replace(/["'`]\s*\+\s*\n?\s*["'`]/g, ""));

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
                    // A refusal a Server Action hands back, and `metadata.title`.
                    if (n.key?.name === "error" || n.key?.name === "title" || n.key?.name === "default")
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

    if (allowed === "*") descend(ast, visitAll, skip);
    else
        descend(
            ast,
            (n) => {
                // A COPY CONSTANT, not any named export. `actions.js` imports `TABLES`
                // from `lib/airtable/client.js`, and collecting every declarator this
                // screen names put eleven Airtable table names in its inventory.
                if (n.type !== "VariableDeclarator") return;
                if (!COPY_NAME.test(n.id?.name ?? "") || !allowed.has(n.id.name)) return;
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
// --check: the inventory against the code
// ---------------------------------------------------------------------------

/**
 * Every string an inventory file quotes as an entry heading, with the files that
 * entry names.
 *
 * THE ENTRY'S OWN `from:` LINE IS WHAT MAKES THE `hand` CLASS CHECKABLE, and this is
 * the assertion that needs no exemption list: it does not ask this file to FIND the
 * string, only whether the claim the entry makes about a named file still holds. So a
 * string authored two modules away and rendered here is verified exactly as a JSXText
 * node is.
 */
export function entriesInInventory(text) {
    const blocks = text.split(/\n(?=- \*\*`)/);
    const out = [];
    for (const block of blocks) {
        if (!/^- \*\*`/.test(block)) continue;
        // The heading runs to the class marker — ` — read · ` or ` — switch · ` — and
        // only its BOLD spans are the strings the entry is about. Two narrowings, both
        // forced by a false alarm: taking every backtick span read
        // `InvoiceForm.js:172-173` as a quotation, and running the heading to the first
        // sub-bullet swallowed a following paragraph, which is how `blocked[key]` became
        // a string this file claimed the screen renders.
        const cuts = [block.search(/—\s*(?:read|switch)\s*·/), block.search(/\n\s+- /)].filter((i) => i !== -1);
        const heading = cuts.length ? block.slice(0, Math.min(...cuts)) : block;
        const quoted = [...heading.matchAll(/\*\*([\s\S]+?)\*\*/g)].flatMap((bold) =>
            [...bold[1].matchAll(/`([^`]+)`/g)].map((m) => collapse(m[1]))
        );
        // ONLY THE `from:` BULLET NAMES FILES. Scanning the whole block took a path out
        // of a sentence comparing this string to another module's and then looked for
        // the string there, which fails while nothing is wrong.
        const fromLine = block.match(/\n\s+- from:([\s\S]*?)(?=\n\s+- |$)/);
        const files = [...(fromLine?.[1] ?? "").matchAll(/`((?:app|lib|components|scripts)\/[\w[\]/.-]+\.js)/g)].map(
            (m) => m[1]
        );
        for (const q of quoted) out.push({ quoted: q, files: [...new Set(files)] });
    }
    return out;
}

/** Every backtick span in the file, which is where a quoted string may be found. */
export function spansIn(text) {
    return collapse([...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join("  "));
}

/**
 * The longest run of literal text in a quoted string — what survives once the
 * `{placeholders}` standing where the code interpolates are removed.
 */
export function longestLiteralRun(quoted) {
    return quoted
        .split(/\{[^}]*\}/)
        .map((part) => collapse(part.replace(/^[\s.,:—·|]+|[\s.,:—·|]+$/g, "")))
        .reduce((best, part) => (part.length > best.length ? part : best), "");
}

const readFileText = (rel) => (existsSync(repoPath(rel)) ? codeHaystack(readFileSync(repoPath(rel), "utf8")) : "");

function checkRoute(route, inventoryPath) {
    const inventory = readFileSync(repoPath(inventoryPath), "utf8");
    // Compared against the file's BACKTICK SPANS rather than its whole text, so a
    // fragment counts only where the inventory is quoting rather than describing.
    const haystack = spansIn(inventory);
    const { files, strings, errors } = stringsForRoute(route);
    const routeText = codeHaystack(files.map((f) => readFileSync(repoPath(f), "utf8")).join("\n"));

    const notInInventory = strings.filter((s) => !haystack.includes(s.text));

    const entries = entriesInInventory(inventory).map((e) => ({ ...e, run: longestLiteralRun(e.quoted) }));
    const checkable = entries.filter(({ run }) => run.length >= MIN_RUN);
    const notInCode = checkable.filter(({ run, files: named }) => {
        const hay = named.length ? named.map(readFileText).join("  ") : routeText;
        return !hay.includes(run);
    });

    return {
        files,
        strings,
        errors,
        notInInventory,
        notInCode,
        quoted: entries.length,
        unverified: entries.length - checkable.length,
    };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function inventoryPathFor(route) {
    const rel = `${INVENTORY_DIR}/${briefFileName(route)}`;
    return existsSync(repoPath(rel)) ? rel : null;
}

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
    let failed = 0;
    let unrun = 0;
    let covered = 0;
    for (const route of routes) {
        const inventoryPath = inventoryPathFor(route);
        if (!inventoryPath) {
            console.log(`~ ${route} — no inventory yet`);
            unrun += 1;
            continue;
        }
        covered += 1;
        const { strings, errors, notInInventory, notInCode, quoted, unverified } = checkRoute(route, inventoryPath);
        const bad = notInInventory.length + notInCode.length + errors.length;
        console.log(
            `${bad === 0 ? "ok" : "FAIL"} ${route} — ${strings.length} found, ` +
                `${notInInventory.length} not in the inventory, ${notInCode.length} of ${quoted} quoted ` +
                `no longer in the code (${unverified} too short to look for)`
        );
        for (const s of notInInventory) console.log(`    missing  ${s.file}:${s.line}  ${JSON.stringify(s.text)}`);
        for (const { quoted, run } of notInCode)
            console.log(`    stale    ${JSON.stringify(quoted)} (looked for ${JSON.stringify(run)})`);
        errors.forEach((e) => console.log(`    UNPARSED ${e}`));
        if (bad > 0) failed += 1;
    }
    console.log("");
    console.log(`${covered} of ${routes.length} screens have an inventory; ${failed} disagree with the code`);
    if (failed > 0) return 1;
    return unrun > 0 ? 2 : 0;
}

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
    // The census is recomputed rather than written down, which is `airtable-ops.mjs`'s
    // move: a number in a document goes stale unread.
    console.log(`\n${total} strings across ${routes.length} screens`);
}
