// Who records what happens to a tool — read in one place, and asked alike by the server's
// gate and by every control a screen draws (#506).
//
// WHAT THIS IS DEFENDING. Only a site manager adds tools, prints their labels, checks a
// tool out or in and retires one, and everybody else reads the same screens without those
// controls. That is two halves in different files, and either can drift from the other
// without anything failing: a screen drawing a control the server refuses is a press that
// lands on a refusal, and a server admitting what the screen hides is a control one request
// away. Nothing but this file pairs them.
//
// SO IT HOLDS FOUR THINGS, AND EACH IS STRUCTURAL:
//
//   1. THE ONE READING. `isSiteManager` by value, no read of a user's `isSiteManager` under
//      app/ or lib/ outside lib/siteManager.js, the field's name spelled in the mapper
//      alone, and nothing on the tools axis asking the office's flag or the role instead —
//      but for the one read #509 admits, what a list starts from (`SCOPE` below).
//   2. THE SERVER. Every export of a `"use server"` file on the tools axis is
//      `withSiteManagerAction(handler)`, found by walking the tree rather than listed — so
//      a fifth action fails until it is wrapped and this inventory says so — and no handler
//      is exported, so the wrapper cannot be stepped round. lib/authz.js binds that wrapper
//      to `createFlagGuard` over a gate whose verdict is `isSiteManager`, with a refusal that
//      re-renders the page and says nothing.
//   3. THE SCREENS. Each tools page asks `isSiteManager` once, into `recorder`, and every
//      control a site manager alone uses is drawn under it; the tool's list is handed it as
//      `selects` and draws its boxes and its bar under that.
//   4. THE LABELS' DIALOG opens on nothing when the read behind it is refused.
//
// WHAT A PASS DOES NOT PROVE. That a refused press re-renders anything — `refresh()` is the
// framework's, and the re-render was seen in a browser — or that a control is missing from a
// page as drawn; both are browser measurements recorded in the pull request. What
// `planTransition` offers a reader who is not a site manager is `offline/tool-transition.mjs`'s,
// by value, since the plan is that module's, and what the account says of a site manager is
// `offline/navigation.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { isSiteManager } from "../../../lib/siteManager.js";
import { callsTo, listJsFiles, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk } from "./_ast.mjs";
import { listEntryPoints } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Who records what happens to a tool, read once and asked alike (#506)";

const READER = "lib/siteManager.js";
const MAPPER = "lib/airtable/users.js";
const AUTHZ = "lib/authz.js";
const FIELD = "Is Site Manager";

const LIST = "app/(tools)/tools/page.js";
const TOOL = "app/(tools)/tools/[toolRecordId]/page.js";
const ITEM = "app/(tools)/tool-items/[toolItemId]/page.js";
const TOOL_LIST = "app/(tools)/tools/[toolRecordId]/ToolItemList.js";
const LABELS = "app/(tools)/tool-items/LabelsDialog.js";

/** The tools axis's server actions, each `file::export`. A fifth fails until it is here. */
const TOOLS_ACTIONS = [
    "app/(tools)/tool-items/[toolItemId]/actions.js::recordToolItemEventAction",
    "app/(tools)/tool-items/[toolItemId]/actions.js::retireToolItemAction",
    "app/(tools)/tool-items/actions.js::readToolItemLabelsAction",
    "app/(tools)/tools/actions.js::registerToolItemsAction",
];

/**
 * The controls a site manager alone uses, by the page that draws them, and how many times
 * each is drawn there. `flag` is what each must stand under: the page's `recorder`, or the
 * list's `selects` the page hands it. `text` names a sentence rather than an element.
 */
const GATED = [
    { file: LIST, element: "RegistrationDialog", count: 2, flag: "recorder" },
    { file: TOOL, element: "RegistrationDialog", count: 2, flag: "recorder" },
    { file: TOOL, element: "RegistrationShortfall", count: 1, flag: "recorder" },
    { file: TOOL, element: "RegistrationUnlogged", count: 1, flag: "recorder" },
    { file: TOOL, text: "COPY.noToolItems", count: 1, flag: "recorder" },
    { file: ITEM, element: "LabelsDialog", count: 1, flag: "recorder" },
    { file: TOOL_LIST, element: "Checkbox", count: 2, flag: "selects" },
    { file: TOOL_LIST, element: "SelectionBar", count: 1, flag: "selects" },
];

/** `a.b.c` for a member chain, the name for an identifier, the node's type otherwise. */
function nameOf(node) {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" && !node.computed) return `${nameOf(node.object)}.${node.property.name}`;
    return node?.type ?? "none";
}

/** Every line on which a user's `isSiteManager` is READ — a member or a destructured key. */
export function siteManagerReads({ ast, source }) {
    const lines = [];
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    walk(ast, (n) => {
        if (n.type === "MemberExpression" && !n.computed && n.property?.name === "isSiteManager") lines.push(lineOf(n.start));
        if (n.type === "ObjectPattern") {
            for (const p of n.properties) if (p.key?.name === "isSiteManager") lines.push(lineOf(p.start));
        }
    });
    return lines;
}

/**
 * THE ONE READ OF THE OFFICE'S FLAG THE AXIS ADMITS (#509): what a tools list starts from —
 * every tool item for the office, a reader's own jobs' for anybody else — which is a question
 * about the office and not about who records, so the mark cannot answer it. It is the flag
 * alone, in this one function, once; the role is admitted nowhere.
 */
const SCOPE = { file: "lib/toolListView.js", fn: "toolListScope", name: "isAdmin" };

/**
 * Every line on which the office's flag or the role is read off anything, leaving out reads
 * inside `skip` — a function declaration's name — of the flag named `admitted`.
 */
function officeReads({ ast, source }, { skip = null, admitted = null } = {}) {
    const lines = [];
    const lineOf = (offset) => source.slice(0, offset).split("\n").length;
    const skipped = [];
    if (skip) walk(ast, (n) => n.type === "FunctionDeclaration" && n.id?.name === skip && skipped.push([n.start, n.end]));
    walk(ast, (n) => {
        if (n.type !== "MemberExpression" || n.computed || !["isAdmin", "role"].includes(n.property?.name)) return;
        if (n.property.name === admitted && skipped.some(([start, end]) => n.start >= start && n.end <= end)) return;
        lines.push(lineOf(n.start));
    });
    return lines;
}

/** How many times `name` is read inside the function declaration `fn`. */
function readsInside(ast, fn, name) {
    let count = 0;
    walk(ast, (n) => {
        if (n.type !== "FunctionDeclaration" || n.id?.name !== fn) return;
        walk(n.body, (m) => {
            if (m.type === "MemberExpression" && !m.computed && m.property?.name === name) count++;
        });
    });
    return count;
}

/** Every string literal spelling the field's name. */
function fieldSpellings(ast) {
    let count = 0;
    walk(ast, (n) => {
        if (n.type === "Literal" && n.value === FIELD) count++;
    });
    return count;
}

/**
 * How one action export is built: `wrapper(handler)` with the handler's name, and whether
 * that handler is itself exported — which would make it an entry point of its own, ungated.
 */
export function wrappingOf(ast, exportName) {
    let init = null;
    const exported = new Set();
    for (const node of ast.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        if (node.declaration?.type === "FunctionDeclaration") exported.add(node.declaration.id.name);
        for (const d of node.declaration?.declarations ?? []) {
            exported.add(d.id.name);
            if (d.id.name === exportName) init = d.init;
        }
        for (const s of node.specifiers ?? []) exported.add(s.exported.name);
    }
    if (init?.type !== "CallExpression") return "not a wrapped export";
    const handler = init.arguments.at(-1);
    const handlerName = handler?.type === "Identifier" ? handler.name : handler?.type ?? "none";
    return `${nameOf(init.callee)}(${init.arguments.length} arg${init.arguments.length === 1 ? "" : "s"}), handler ${
        exported.has(handlerName) ? "EXPORTED" : "not exported"
    }`;
}

/**
 * The conditions every occurrence of an element — or of an expression reading `text` — is
 * drawn under, as the source states them, a false branch negated. One entry per occurrence.
 */
export function conditionsOf(ast, { element, text }) {
    const found = [];
    const skip = new Set(["type", "start", "end", "loc", "range", "parent"]);
    const branches = {
        ConditionalExpression: ["consequent", "alternate"],
        LogicalExpression: ["right"],
        IfStatement: ["consequent", "alternate"],
    };
    const said = (test) => {
        if (!test) return "none";
        if (test.type === "Identifier" || test.type === "MemberExpression") return nameOf(test);
        if (test.type === "Literal") return JSON.stringify(test.value);
        if (test.type === "UnaryExpression") return `${test.operator}${said(test.argument)}`;
        if (test.type === "BinaryExpression" || test.type === "LogicalExpression") return `${said(test.left)} ${test.operator} ${said(test.right)}`;
        if (test.type === "CallExpression") return `${nameOf(test.callee)}(…)`;
        return test.type;
    };
    // A conjunction is each of its parts: `a && b && <X/>` parses as `(a && b) && <X/>`, and
    // what draws X there is a and b both.
    const conjuncts = (test) =>
        test?.type === "LogicalExpression" && test.operator === "&&" ? [...conjuncts(test.left), ...conjuncts(test.right)] : [said(test)];
    const conditionsAt = (node, key) =>
        key === "alternate" ? [`!(${said(node.test)})`] : conjuncts(node.type === "LogicalExpression" ? node.left : node.test);
    (function visit(node, under) {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) return node.forEach((child) => visit(child, under));
        if (typeof node.type !== "string") return;
        const hit = element
            ? node.type === "JSXOpeningElement" && node.name?.name === element
            : node.type === "JSXExpressionContainer" && nameOf(node.expression) === text;
        if (hit) found.push(under);
        for (const key of Object.keys(node)) {
            if (skip.has(key)) continue;
            visit(node[key], branches[node.type]?.includes(key) ? [...under, ...conditionsAt(node, key)] : under);
        }
    })(ast, []);
    return found;
}

/** What a page binds `recorder` to, as written, and how often it asks `isSiteManager`. */
function recorderOf({ ast, source }) {
    let bound = "not bound";
    walk(ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "recorder" && n.init) bound = source.slice(n.init.start, n.init.end);
    });
    return `${bound}, asked ${callsTo(ast, "isSiteManager").length} time(s)`;
}

/** Whether a module imports `name` from a specifier ending in `from`. */
function importsFrom(ast, name, from) {
    return ast.body.some(
        (n) => n.type === "ImportDeclaration" && n.source.value.endsWith(from) && n.specifiers.some((s) => s.imported?.name === name)
    );
}

export function run({ check, assert, log }) {
    const root = toPosix(repoPath("."));
    const scanned = ["app", "lib"].flatMap((dir) => listJsFiles(repoPath(dir)).map((abs) => toPosix(abs).slice(root.length + 1)));
    assert(`walked ${scanned.length} files under app/ and lib/`, scanned.length > 150);

    // ── 1: the one reading ────────────────────────────────────────────────────
    log("the one reading of `Is Site Manager`:");
    check("a site manager is a reader marked true", isSiteManager({ isSiteManager: true }), true);
    check("  and a reader unmarked is not", isSiteManager({ isSiteManager: false }), false);
    check("  nor one whose record carries no such field", isSiteManager({}), false);
    check("  nor no reader at all", isSiteManager(null), false);
    check(
        "  nor a value that is merely truthy",
        ["true", 1, "yes"].map((value) => isSiteManager({ isSiteManager: value })).join(","),
        "false,false,false"
    );
    check("  nor the office or the President, by their own flags", isSiteManager({ isAdmin: true, role: "President" }), false);

    const reads = scanned.map((rel) => [rel, siteManagerReads(parseFile(rel))]).filter(([, lines]) => lines.length > 0);
    check(
        "the reader's mark is read in lib/siteManager.js and nowhere else",
        reads.map(([rel, lines]) => `${rel}:${lines.join(",")}`).join(" | "),
        `${READER}:${siteManagerReads(parseFile(READER)).join(",")}`
    );
    assert("  and is read there", siteManagerReads(parseFile(READER)).length === 1);
    // ANTI-VACUITY: a member read and a destructured one are both seen, and an object key —
    // which is how the mapper WRITES it — is not a read.
    check(
        "  a member read and a destructured one are each seen, and a key that writes it is not",
        siteManagerReads(
            parseSource(
                "const a = user.isSiteManager;\nconst { isSiteManager } = user;\nconst written = { isSiteManager: true };\n",
                "<planted-reads>"
            )
        ).join(","),
        "1,2"
    );
    const spelled = scanned.filter((rel) => fieldSpellings(parseFile(rel).ast) > 0);
    check("the field's name is spelled by the mapper alone", spelled.join(", "), MAPPER);
    const mapper = parseFile(MAPPER);
    let mapped = "not mapped";
    walk(mapper.ast, (n) => {
        if (n.type === "Property" && n.key?.name === "isSiteManager") mapped = mapper.source.slice(n.value.start, n.value.end);
    });
    check("  which carries it on the user, an unmarked box reading as false", mapped, `record.get("${FIELD}") || false`);

    const toolsFiles = scanned.filter((rel) => rel.startsWith("app/(tools)/") || /^lib\/tool[A-Z][^/]*\.js$/.test(rel));
    assert(`  ${toolsFiles.length} files on the tools axis are walked`, toolsFiles.length > 20);
    const office = toolsFiles
        .map((rel) => [rel, officeReads(parseFile(rel), rel === SCOPE.file ? { skip: SCOPE.fn, admitted: SCOPE.name } : {})])
        .filter(([, lines]) => lines.length > 0);
    check(
        "nothing on the tools axis asks the office's flag or the role instead",
        office.map(([rel, lines]) => `${rel}:${lines.join(",")}`).join(" | "),
        ""
    );
    check(
        "  and a planted read of either is seen",
        officeReads(parseSource("const a = user.isAdmin || user.role === 'President';\n", "<planted-office>")).join(","),
        "1,1"
    );
    check(
        `  but for what a list starts from (#509): the flag, read once in ${SCOPE.file}:${SCOPE.fn}`,
        readsInside(parseFile(SCOPE.file).ast, SCOPE.fn, SCOPE.name),
        1
    );
    check(
        "  and that admission reaches neither the role there nor the flag anywhere else",
        officeReads(
            parseSource(
                "export function toolListScope(user) { return user.isAdmin && user.role; }\nconst b = user.isAdmin;\n",
                "<planted-scope>"
            ),
            { skip: SCOPE.fn, admitted: SCOPE.name }
        ).join(","),
        "1,2"
    );

    // ── 2: the server ────────────────────────────────────────────────────────
    log("");
    log("every server action on the tools axis is a site manager's:");
    // Every file under app/ and lib/ was parsed above, where a failure throws and names it, so
    // this walk meets none — and if it ever did, an unread file is an unchecked one.
    const { entries } = listEntryPoints({
        onParseError: (message) => {
            throw new Error(message);
        },
    });
    const actions = entries.filter((e) => e.kind !== "page" && (e.file.startsWith("app/(tools)/") || e.file.startsWith("app/t/")));
    check(
        "the axis's server actions are the four this gate is for, found by walking",
        actions.map((e) => `${e.file}::${e.name}`).sort().join(" | "),
        [...TOOLS_ACTIONS].sort().join(" | ")
    );
    check(
        "  each withSiteManagerAction around a handler nobody can call round it",
        actions.map((e) => `${e.name}: ${wrappingOf(e.ast, e.name)}`).sort().join(" | "),
        TOOLS_ACTIONS.map((key) => `${key.split("::")[1]}: withSiteManagerAction(1 arg), handler not exported`).sort().join(" | ")
    );
    // ANTI-VACUITY: the classifier tells the right wrapper from another, a handler kept in from
    // one exported beside it, and a plain export from a wrapped one.
    const planted = parseSource(
        "export const a = withSiteManagerAction(aHandler);\nasync function aHandler() {}\n" +
            "export const b = withAdminAction(() => null, bHandler);\nasync function bHandler() {}\n" +
            "export const c = withSiteManagerAction(cHandler);\nexport async function cHandler() {}\n" +
            "export async function d() {}\n",
        "<planted-actions>"
    ).ast;
    check(
        "  and a planted file's four shapes are told apart",
        ["a", "b", "c", "d"].map((name) => wrappingOf(planted, name)).join(" | "),
        "withSiteManagerAction(1 arg), handler not exported | withAdminAction(2 args), handler not exported | " +
            "withSiteManagerAction(1 arg), handler EXPORTED | not a wrapped export"
    );

    const authz = parseFile(AUTHZ);
    const declared = (name) => {
        let found = null;
        walk(authz.ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === name) found = n.init;
        });
        return found;
    };
    const text = (node) => (node ? authz.source.slice(node.start, node.end).replace(/\s+/g, " ") : "none");
    check(
        "lib/authz.js binds the wrapper to one guard and one refusal",
        text(declared("withSiteManagerAction")),
        "(handler) => siteManagerGuard(refuseWithThePage, handler)"
    );
    check("  the guard the flag factory makes of the site manager's gate", text(declared("siteManagerGuard")), "createFlagGuard(requireSiteManager)");
    const gate = resolveFunction(authz.ast, "requireSiteManager");
    let verdict = "none";
    walk(gate ?? {}, (n) => {
        if (n.type === "Property" && n.key?.name === "authorized") verdict = text(n.value);
    });
    check("  a gate whose verdict is the one reading", verdict, "isSiteManager(user)");
    check("  after the session's own gate", gate ? callsTo(gate, "requireUser").length : 0, 1);
    assert("  read from lib/siteManager.js", importsFrom(authz.ast, "isSiteManager", "/siteManager"));
    const refusal = resolveFunction(authz.ast, "refuseWithThePage");
    const returned = [];
    walk(refusal ?? {}, (n) => {
        if (n.type === "ReturnStatement") returned.push(text(n.argument));
    });
    check(
        "  and a refusal that renders the page again and says nothing",
        `${refusal ? callsTo(refusal, "refresh").length : 0} refresh, returns ${returned.join(", ")}`,
        "1 refresh, returns null"
    );

    // ── 3: the screens ───────────────────────────────────────────────────────
    log("");
    log("every control a site manager alone uses is drawn under the one answer:");
    for (const file of [LIST, TOOL, ITEM]) {
        const page = parseFile(file);
        check(`  ${file} asks it once, into recorder`, recorderOf(page), "isSiteManager(user), asked 1 time(s)");
        assert(`    reading it from lib/siteManager.js`, importsFrom(page.ast, "isSiteManager", "/lib/siteManager"));
    }
    const drawn = GATED.map((gated) => {
        const occurrences = conditionsOf(parseFile(gated.file).ast, gated);
        const marks = occurrences.map((under) => (under.includes(gated.flag) ? "under" : "OPEN"));
        return `${gated.file}#${gated.element ?? gated.text}: ${marks.join(",")}`;
    });
    check(
        "each is drawn under it, and only where the page draws it",
        drawn.join(" | "),
        GATED.map((gated) => `${gated.file}#${gated.element ?? gated.text}: ${Array(gated.count).fill("under").join(",")}`).join(" | ")
    );
    const toolPage = parseFile(TOOL);
    let handed = "not handed";
    walk(toolPage.ast, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "ToolItemList") {
            const value = n.attributes.find((a) => a.name?.name === "selects")?.value?.expression;
            handed = value ? nameOf(value) : "not handed";
        }
    });
    check("  and the tool's list is handed the same answer as `selects`", handed, "recorder");
    const list = parseFile(TOOL_LIST);
    let readsSelects = false;
    walk(list.ast, (n) => {
        if (n.type === "ObjectPattern") readsSelects ||= n.properties.some((p) => p.key?.name === "selects");
    });
    assert("    which the list takes as a prop", readsSelects);
    // ANTI-VACUITY: an opener drawn for every reader, one drawn for a reader on a job, one
    // drawn for a site manager, one for a site manager on a further condition and one on that
    // condition alone read as OPEN, OPEN, under, under and OPEN — so `under` is a fact about
    // the condition, a conjunction's parts each count, and there being a condition is not it.
    const plantedPage = parseSource(
        "function P() { return (<div>\n" +
            "  <RegistrationDialog />\n" +
            "  {canRegister && <RegistrationDialog />}\n" +
            "  {recorder && <RegistrationDialog />}\n" +
            "  {recorder && account.unwritten > 0 && <RegistrationDialog />}\n" +
            "  {account.unwritten > 0 && <RegistrationDialog />}\n" +
            "</div>); }\n",
        "<planted-page>"
    ).ast;
    check(
        "  a planted page's five openers read as drawn for anyone, a job, a site manager, one on more, and more alone",
        conditionsOf(plantedPage, { element: "RegistrationDialog" })
            .map((under) => (under.includes("recorder") ? "under" : "OPEN"))
            .join(","),
        "OPEN,OPEN,under,under,OPEN"
    );
    check(
        "  and a page binding recorder to anything else is read as that",
        recorderOf(parseSource("const recorder = canRegisterToolItems(user, jobs);\n", "<planted-recorder>")),
        "canRegisterToolItems(user, jobs), asked 0 time(s)"
    );

    // ── 4: the labels' dialog opens on nothing when the read is refused ──────
    log("");
    log("a refused read opens no labels:");
    const labels = parseFile(LABELS).source.replace(/\/\/[^\n]*\n/g, "\n");
    const guarded = /const read = await readToolItemLabelsAction\(toolItemIds\);\s*if \(!read\) return;\s*setRun\(read\);/;
    assert("the dialog sets no run and opens nothing on a null read", guarded.test(labels));
    assert(
        "  and a press that opens whatever comes back is seen not to",
        !guarded.test("const read = await readToolItemLabelsAction(toolItemIds);\n setRun(read);\n setOpen(true);\n")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
