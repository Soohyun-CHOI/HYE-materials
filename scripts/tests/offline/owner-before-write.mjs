// A request a caller names is asked whose it is before anything is computed or
// written about it (#440).
//
// THE GAP THIS CLOSES IS AN EXEMPTION'S OWN CLAIM. `offline/authz-structure.mjs`
// exempts every `requireUser()` action on the ground that "the actual authorization is
// the record-by-record comparison in the body", and what it can verify of an exemption
// is only that `requireUser` is named somewhere inside. So the sentence that carries
// the whole of those endpoints' authorization was checked by nothing — and for two of
// them it was false: `saveDraftAction` and `createPRAction` rewrote whichever request
// `existingDraftRecordId` named, with no comparison at all. This file holds that
// sentence where it can be held, in three parts.
//
//   1. THE INVENTORY. Every call under `app/` and `lib/` that turns an id into a
//      request — `getPRById`, `getPRByRecordId`, `getPRsByRecordIds`, and the two
//      local helpers that do it for their callers, `loadPRContext` and `resumedDraft`
//      — is classified here, by the named function it sits in. A call this file has
//      not heard of fails until somebody says what it is, which is the question a new
//      write path has to answer. A row naming a call that is gone fails too.
//   2. THE JUDGED ROWS. A function that reads a request and then writes must ask the
//      declared judgment ABOUT THE RECORD IT READ, let the answer decide a return, ask
//      it outside every `try`, before the function's first side effect — and, unless
//      the row says why not, before anything else reads that record or the id it was
//      read by. That last clause is #440's order: the duplicate check used to run
//      before the owner was known, and could answer in the refusal's place.
//   3. THE CHILD ID. Edit and continue carries `existing:<quotation record id>` per
//      item, and a quotation it would link must be one of the request's own. The one
//      site is held by shape: one reader of that encoding, judged against
//      `quotationRowIds` before the `try`, and nothing inside the `try` reading it
//      again.
//
// WHAT COUNTS AS A SIDE EFFECT IS DERIVED, NOT LISTED. It starts from what writes the
// base — a `create`, `update`, `destroy` or `replace` on `base(...)` — plus a mail
// send and a Blob `put`/`del`, and spreads to every function that calls one, through
// its own file and through imports, until nothing new is added. A hand list of
// writers would be one more inventory a new writer could be missing from.
//
// WHAT THIS CANNOT SEE. Source order is not execution order (`_ast.mjs`): a judgment
// inside `if (false)` or behind an early return passes. Whether the DECLARED judgment
// is the right one for the path is the row's claim, not a finding — a row naming the
// wrong predicate passes as long as it is asked in the right place. Whether the user
// the judgment is handed came from the session rather than the submission is not
// traced. A write reached through something the derivation cannot follow — a
// dynamic call, a callback stored and invoked later — is invisible, and so is a
// request read by a raw `base(...)` query outside `lib/airtable/`. A child id other
// than the quotation choice is not asked about. And none of this runs anything: that
// a refused call writes nothing is `verify-draft-owner-440.mjs`'s, against the
// running app and the base.

import { dirname, posix } from "path";
import {
    REPO_ROOT,
    calleeName,
    insideTry,
    isFunctionNode,
    listJsFiles,
    parseFile,
    parseSource,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A request a caller names is asked whose it is before anything is written (#440)";

/** The calls that turn an id into a request, and the two helpers that do it for a caller. */
const READERS = new Set(["getPRById", "getPRByRecordId", "getPRsByRecordIds", "loadPRContext", "resumedDraft"]);

/** The wrappers that make an export role-gated, from `lib/authz.js`. */
const ROLE_WRAPPERS = new Set(["withAdminAction", "withPresidentAction"]);

/**
 * THE INVENTORY, one row per (file, named function, reader). `kind` is one of:
 *
 *   judged  — the function writes, so `judgment` must be asked first (part 2).
 *             `judgment` names a call made about the record read, or is `.refusal`
 *             for a caller of `resumedDraft`, which judges for it and returns the
 *             answer. `id` names the id the record was read by, which nothing may
 *             touch before the judgment either. `existenceFirst` is the one excuse
 *             from that clause, with its reason; a row that no longer needs it fails.
 *   read    — the function makes no side effect at all; asserted.
 *   wrapped — the function is the handler of a role-wrapped export, whose gate is
 *             the wrapper's; asserted that it is.
 *   server  — the id came off a record the function's own caller already judged,
 *             or the request is read as an input to something else's write; the
 *             reason is the whole of the row.
 */
const INVENTORY = [
    // ── the request form ───────────────────────────────────────────────────────
    {
        file: "app/prs/new/actions.js",
        fn: "resumedDraft",
        reader: "getPRByRecordId",
        kind: "judged",
        judgment: "ownDraftRefusal",
        id: "recordId",
        why: "the draft a save names, judged and handed back to the save",
    },
    {
        file: "app/prs/new/actions.js",
        fn: "saveDraftAction",
        reader: "resumedDraft",
        kind: "judged",
        judgment: ".refusal",
        id: "existingDraftRecordId",
        why: "a draft save",
    },
    {
        file: "app/prs/new/actions.js",
        fn: "createPRAction",
        reader: "resumedDraft",
        kind: "judged",
        judgment: ".refusal",
        id: "existingDraftRecordId",
        why: "a submit — ahead of the duplicate check as well as the In Review flip",
    },
    {
        file: "app/prs/new/actions.js",
        fn: "deleteDraftAction",
        reader: "getPRById",
        kind: "judged",
        judgment: "ownDraftRefusal",
        id: "prId",
        why: "deleting a draft asks what a save asks, in the same words",
    },
    // ── the signing chain ──────────────────────────────────────────────────────
    {
        file: "app/prs/[prId]/actions.js",
        fn: "loadPRContext",
        reader: "getPRById",
        kind: "read",
        why: "reads for its callers, each of which is a judged row below",
    },
    ...["approveAction", "editAndContinueAction", "returnForCorrectionAction"].map((fn) => ({
        file: "app/prs/[prId]/actions.js",
        fn,
        reader: "loadPRContext",
        kind: "judged",
        judgment: "getCurrentTurn",
        id: "prId",
        why: "a signing turn belongs to one person, and the turn is that person's",
    })),
    {
        file: "app/prs/[prId]/actions.js",
        fn: "withdrawAction",
        reader: "getPRById",
        kind: "judged",
        judgment: "isRequester",
        id: "prId",
        existenceFirst:
            "`if (!pr) return { error: \"PR not found.\" }` runs before the requester is asked, so a stranger holding a " +
            "guessable PR ID learns that it exists from `You can only withdraw your own PR.`. docs/notes/backlog.md " +
            "carries it with the order's three siblings; the day it is fixed this row loses the excuse and the check " +
            "says so.",
        why: "the requester withdraws their own request in review",
    },
    {
        file: "app/prs/[prId]/actions.js",
        fn: "generatePOHandler",
        reader: "getPRById",
        kind: "wrapped",
        why: "the office's retry for an approved request with no order; the gate is withAdminAction",
    },
    // ── the order ──────────────────────────────────────────────────────────────
    {
        file: "app/pos/[poId]/actions.js",
        fn: "syncPRStatusToPOSigned",
        reader: "getPRByRecordId",
        kind: "server",
        why:
            "the request behind an order its two callers have already judged — signPOAction is " +
            "withPresidentAction and regeneratePDFAction asks canSendPOToVendor first",
    },
    ...["regeneratePDFAction", "sendPOToVendorAction"].map((fn) => ({
        file: "app/pos/[poId]/actions.js",
        fn,
        reader: "getPRByRecordId",
        kind: "judged",
        judgment: "canSendPOToVendor",
        why: "the requester of the request behind the order, or the office (#281)",
    })),
    {
        file: "lib/poWithdraw.js",
        fn: "withdrawPOAsRequester",
        reader: "getPRByRecordId",
        kind: "judged",
        judgment: "requesterOf",
        existenceFirst:
            "`if (!pr) return { error: \"PO not found.\" }` is asked before the requester, and the order's own not-found " +
            "above it and `Only the requester can withdraw this PO.` below it tell a stranger an order exists. " +
            "docs/notes/backlog.md carries it beside withdrawAction's.",
        why: "the parent request's requester withdraws the order (#138)",
    },
    {
        file: "lib/poPdf.js",
        fn: "generateAndAttachPOPdf",
        reader: "getPRByRecordId",
        kind: "server",
        why: "the request behind an order its callers judged — the signature, and canSendPOToVendor on the retry",
    },
    {
        file: "lib/notifications.js",
        fn: "notifyPOSigned",
        reader: "getPRByRecordId",
        kind: "server",
        why: "mails the requester of an order the President has just signed; the id comes off that order",
    },
    // ── deliveries ─────────────────────────────────────────────────────────────
    {
        file: "app/deliveries/new/actions.js",
        fn: "createDeliveryAction",
        reader: "getPRByRecordId",
        kind: "server",
        why:
            "the request behind the packing list's order, read for the address it carries and written nowhere; " +
            "the delivery's own gate is canAccessJobDeliveries",
    },
    // ── screens and reads ──────────────────────────────────────────────────────
    ...[
        ["app/prs/[prId]/page.js", "renderPRDetailPage", "getPRById"],
        ["app/pos/[poId]/page.js", "renderPODetailPage", "getPRByRecordId"],
        ["app/pos/page.js", "renderPOListPage", "getPRsByRecordIds"],
        ["app/api/files/[axis]/[documentId]/[filename]/route.js", "openQuotation", "getPRByRecordId"],
        ["app/api/files/[axis]/[documentId]/[filename]/route.js", "openPurchaseOrder", "getPRByRecordId"],
        ["lib/prDraft.js", "loadPRDraft", "getPRById"],
        ["lib/deliveryCandidates.js", "getDeliveryCandidates", "getPRsByRecordIds"],
        ["lib/directPurchaseClaim.js", "getDirectPurchasesAwaitingRequest", "getPRsByRecordIds"],
        ["lib/directPurchaseClaim.js", "describeClaimRefusal", "getPRsByRecordIds"],
        ["lib/invoiceVisibility.js", "resolveInvoiceScope", "getPRsByRecordIds"],
        ["lib/materialHistory.js", "searchMaterialPrices", "getPRsByRecordIds"],
        ["lib/materialHistory.js", "getMaterialPurchaseHistory", "getPRsByRecordIds"],
        ["lib/overagePR.js", "getOverageContext", "getPRsByRecordIds"],
        ["lib/overagePR.js", "getOverageBannerFactsForPO", "getPRsByRecordIds"],
    ].map(([file, fn, reader]) => ({ file, fn, reader, kind: "read", why: "a read" })),
];

// ── shared machinery ──────────────────────────────────────────────────────────

function jsFilesUnder(dir) {
    const root = toPosix(REPO_ROOT);
    return listJsFiles(`${REPO_ROOT}/${dir}`)
        .map((full) => toPosix(full).slice(root.length + 1))
        .sort();
}

function lineOf(source, node) {
    return source.slice(0, node.start).split("\n").length;
}

function contains(outer, inner) {
    return Boolean(outer) && outer.start <= inner.start && inner.end <= outer.end;
}

/** Every node's parent, over a whole tree. */
function parentsOf(root) {
    const parents = new Map();
    (function visit(n, parent) {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) {
            for (const c of n) visit(c, parent);
            return;
        }
        if (typeof n.type !== "string") return;
        parents.set(n, parent);
        for (const key of Object.keys(n)) {
            if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
            visit(n[key], n);
        }
    })(root, null);
    return parents;
}

/** Every NAMED function in a file, at any depth, with the name a row uses. */
function namedFunctions(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name) found.push({ name: n.id.name, node: n });
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && isFunctionNode(n.init)) {
            found.push({ name: n.id.name, node: n.init });
        }
    });
    return found;
}

/** The innermost named function containing `node`. */
function enclosingNamed(functions, node) {
    let best = null;
    for (const f of functions) {
        if (contains(f.node, node) && (!best || contains(best.node, f.node))) best = f;
    }
    return best;
}

/** A repo-relative module path for an import specifier, or the bare package name. */
function resolveSpecifier(fromRel, spec) {
    const withExt = (p) => (p.endsWith(".js") ? p : `${p}.js`);
    if (spec.startsWith("@/")) return withExt(spec.slice(2));
    if (spec.startsWith("./") || spec.startsWith("../")) {
        return withExt(posix.normalize(posix.join(dirname(fromRel), spec)));
    }
    return spec;
}

/** local binding -> { module, imported } for a file's imports. */
function importsOf(ast, rel) {
    const map = new Map();
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue;
        const from = resolveSpecifier(rel, node.source.value);
        for (const s of node.specifiers) {
            if (s.type === "ImportSpecifier") map.set(s.local.name, { module: from, imported: s.imported.name });
        }
    }
    return map;
}

/** Top-level functions of a file by name, a wrapped export resolving to its handler's name. */
function topLevelFunctions(ast) {
    const fns = new Map();
    for (const node of ast.body) {
        const decl =
            node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration" ? node.declaration : node;
        if (decl?.type === "FunctionDeclaration" && decl.id) fns.set(decl.id.name, decl);
        if (decl?.type === "VariableDeclaration") {
            for (const d of decl.declarations) {
                if (d.id?.type !== "Identifier") continue;
                if (isFunctionNode(d.init)) fns.set(d.id.name, d.init);
                // `export const x = withAdminAction(refuse, handler)` — the export writes
                // whatever its handler writes.
                if (d.init?.type === "CallExpression") fns.set(d.id.name, d.init);
            }
        }
    }
    return fns;
}

const BASE_MUTATIONS = new Set(["create", "update", "destroy", "replace"]);

/** Does this call write the base, send a mail, or put or delete a Blob object — directly? */
function isDirectEffect(call, imports) {
    const c = call.callee;
    if (c?.type === "MemberExpression" && !c.computed && BASE_MUTATIONS.has(c.property?.name)) {
        const obj = c.object;
        if (obj?.type === "CallExpression" && obj.callee?.type === "Identifier" && obj.callee.name === "base") return true;
    }
    // Resend's `resend.emails.send(...)`, which is what every mail in lib/email.js is.
    if (
        c?.type === "MemberExpression" &&
        c.property?.name === "send" &&
        c.object?.type === "MemberExpression" &&
        c.object.property?.name === "emails"
    ) {
        return true;
    }
    if (c?.type === "Identifier") {
        const imp = imports.get(c.name);
        if (imp?.module === "@vercel/blob" && (imp.imported === "put" || imp.imported === "del")) return true;
    }
    return false;
}

/**
 * THE DERIVATION: file -> the names of its top-level functions that make a side effect,
 * directly or through anything they call, to a fixed point across the whole tree.
 */
function deriveWriters(parsed) {
    const ctx = new Map();
    for (const [rel, { ast }] of parsed) {
        ctx.set(rel, { imports: importsOf(ast, rel), fns: topLevelFunctions(ast), writers: new Set() });
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (const [rel, file] of ctx) {
            for (const [name, node] of file.fns) {
                if (file.writers.has(name)) continue;
                let writes = false;
                walk(node, (n) => {
                    if (writes || n.type !== "CallExpression") return;
                    if (isDirectEffect(n, file.imports) || callsWriter(n, rel, ctx)) writes = true;
                });
                if (writes) {
                    file.writers.add(name);
                    changed = true;
                }
            }
        }
    }
    return ctx;
}

/** Is this call, by name, a call of a function the derivation has marked as a writer? */
function callsWriter(call, rel, ctx) {
    if (call.callee?.type !== "Identifier") return false;
    const name = call.callee.name;
    const file = ctx.get(rel);
    if (file.writers.has(name)) return true;
    const imp = file.imports.get(name);
    return Boolean(imp && ctx.get(imp.module)?.writers.has(imp.imported));
}

/** The first call inside `node` that makes a side effect, or null. */
function firstSideEffect(node, rel, ctx) {
    const file = ctx.get(rel);
    let first = null;
    walk(node, (n) => {
        if (n.type !== "CallExpression") return;
        if (isDirectEffect(n, file.imports) || callsWriter(n, rel, ctx)) {
            if (!first || n.start < first.start) first = n;
        }
    });
    return first;
}

// ── part 2: the judged rows ──────────────────────────────────────────────────

/** The names a reader call's result is bound to: `x = …`, `const x = …`, `const { a, b } = …`. */
function bindingNames(call, parents) {
    let cur = call;
    let parent = parents.get(cur);
    while (
        parent &&
        (parent.type === "AwaitExpression" ||
            parent.type === "ConditionalExpression" ||
            parent.type === "LogicalExpression" ||
            parent.type === "ParenthesizedExpression")
    ) {
        cur = parent;
        parent = parents.get(cur);
    }
    const names = [];
    if (parent?.type === "VariableDeclarator" && parent.init === cur) {
        if (parent.id.type === "Identifier") names.push(parent.id.name);
        if (parent.id.type === "ObjectPattern") {
            for (const p of parent.id.properties) if (p.value?.type === "Identifier") names.push(p.value.name);
        }
    }
    if (parent?.type === "AssignmentExpression" && parent.right === cur && parent.left.type === "Identifier") {
        names.push(parent.left.name);
    }
    return names;
}

function endsInExit(node) {
    let exits = false;
    walk(node, (n) => {
        if (n.type === "ReturnStatement" || n.type === "ThrowStatement") exits = true;
    });
    return exits;
}

/** Identifiers in `root` that REFERENCE `name` — not declarations, keys, properties or assignment targets. */
function referencesTo(root, name, parents) {
    const refs = [];
    walk(root, (n) => {
        if (n.type !== "Identifier" || n.name !== name) return;
        const p = parents.get(n);
        if (p?.type === "VariableDeclarator" && p.id === n) return;
        if (p?.type === "MemberExpression" && p.property === n && !p.computed) return;
        // A key is never a reference. acorn gives a shorthand property a VALUE node of
        // its own, so `{ pr }` in an object literal is still counted — through its value.
        if (p?.type === "Property" && p.key === n && !p.computed) return;
        if (p?.type === "Property" && p.value === n && parents.get(p)?.type === "ObjectPattern") return;
        if (p?.type === "AssignmentExpression" && p.left === n) return;
        if (isFunctionNode(p) && p.params?.includes(n)) return;
        refs.push(n);
    });
    return refs;
}

/** Non-computed member reads of property `name` (`x.name`), e.g. `parsed.existingDraftRecordId`. */
function propertyReads(root, name) {
    const found = [];
    walk(root, (n) => {
        if (n.type === "MemberExpression" && !n.computed && n.property?.name === name) found.push(n);
    });
    return found;
}

/** Is `node` the whole argument of an `if (!<node>) return …` — a presence test that leaves? */
function isPresenceTest(node, parents) {
    const unary = parents.get(node);
    if (unary?.type !== "UnaryExpression" || unary.operator !== "!") return false;
    const ifs = parents.get(unary);
    return ifs?.type === "IfStatement" && ifs.test === unary && endsInExit(ifs.consequent);
}

/**
 * Why a judged row does not hold, or null. `fnNode` is the named function, `reads` the
 * reader calls inside it, `rel`/`ctx` for the side-effect derivation.
 */
export function judgedRefusal({ fnNode, reads, row, rel, ctx }) {
    const parents = parentsOf(fnNode);
    const first = firstSideEffect(fnNode, rel, ctx);
    for (const read of reads) {
        const names = bindingNames(read, parents);
        if (names.length === 0) return "the request it reads is bound to nothing a judgment could be asked about";

        // Where the judgment is, and the node that decides.
        let judgment = null;
        let decides = false;
        if (row.judgment === ".refusal") {
            walk(fnNode, (n) => {
                if (judgment || n.type !== "IfStatement") return;
                let reads = false;
                walk(n.test, (m) => {
                    if (
                        m.type === "MemberExpression" &&
                        !m.computed &&
                        m.property?.name === "refusal" &&
                        m.object?.type === "Identifier" &&
                        names.includes(m.object.name)
                    ) {
                        reads = true;
                    }
                });
                if (reads) {
                    judgment = n;
                    decides = endsInExit(n.consequent);
                }
            });
            if (!judgment) return "no `if` asks the helper's `.refusal` about the record it returned";
        } else {
            const calls = [];
            walk(fnNode, (n) => {
                if (n.type !== "CallExpression" || calleeName(n) !== row.judgment) return;
                const aboutRecord = n.arguments.some((a) => {
                    let hit = false;
                    walk(a, (m) => {
                        if (m.type === "Identifier" && names.includes(m.name)) hit = true;
                    });
                    return hit;
                });
                if (aboutRecord) calls.push(n);
            });
            calls.sort((a, b) => a.start - b.start);
            judgment = calls[0] ?? null;
            if (!judgment) return `it never asks ${row.judgment} about the record it read`;
            // The answer has to decide a return: inside an `if` test that leaves, or bound
            // to a name such an `if` (or a `return`) reads.
            let cur = judgment;
            let parent = parents.get(cur);
            while (parent && !decides) {
                if (parent.type === "IfStatement" && parent.test === cur) decides = endsInExit(parent.consequent);
                if (parent.type === "ReturnStatement") decides = true;
                if (parent.type === "VariableDeclarator" && parent.init === cur && parent.id.type === "Identifier") {
                    const bound = parent.id.name;
                    walk(fnNode, (n) => {
                        if (decides) return;
                        if (n.type === "IfStatement" && n.start > judgment.start) {
                            let tests = false;
                            walk(n.test, (m) => {
                                if (m.type === "Identifier" && m.name === bound) tests = true;
                            });
                            if (tests && endsInExit(n.consequent)) decides = true;
                        }
                        if (n.type === "ReturnStatement" && n.start > judgment.start && n.argument) {
                            walk(n.argument, (m) => {
                                if (m.type === "Identifier" && m.name === bound) decides = true;
                            });
                        }
                    });
                    break;
                }
                if (parent.type.endsWith("Statement") || isFunctionNode(parent)) break;
                cur = parent;
                parent = parents.get(cur);
            }
        }
        if (!decides) return `${row.judgment} is asked and its answer decides nothing`;
        if (insideTry(fnNode, judgment)) return `${row.judgment} is asked inside a try, so a refusal leans on a rollback`;
        if (first && first.start < judgment.start) return `${row.judgment} is asked after a side effect`;

        // Nothing about the record before the judgment — its binding, and the id it was read by.
        const before = (n) => n.start < judgment.start && !contains(judgment, n);
        const early = names.flatMap((name) => referencesTo(fnNode, name, parents)).filter(before);
        let idEarly = [];
        if (row.id) {
            idEarly = [...referencesTo(fnNode, row.id, parents), ...propertyReads(fnNode, row.id)]
                .filter(before)
                .filter((n) => !contains(read, n))
                .filter((n) => !isPresenceTest(n, parents));
        }
        const computedEarly = early.length > 0 || idEarly.length > 0;
        if (computedEarly && !row.existenceFirst) {
            return `something reads the record or its id before ${row.judgment} is asked`;
        }
        if (!computedEarly && row.existenceFirst) {
            return "the row excuses a read before the judgment that is no longer there — delete the excuse";
        }
    }
    return null;
}

// ── part 3: the quotation an edit turn links ─────────────────────────────────

/**
 * Why Edit and continue's quotation choice is not judged the way #440 needs, or null:
 * one reader of the encoding, asked before the `try` against a set built from
 * `quotationRowIds`, and nothing inside the `try` reading the encoding again.
 */
export function quotationChoiceRefusal({ ast, action = "editAndContinueAction", parser = "readQuotationChoice", rel, ctx }) {
    const fns = namedFunctions(ast);
    const actionFn = fns.find((f) => f.name === action)?.node;
    const parserFn = fns.find((f) => f.name === parser)?.node;
    if (!actionFn) return `${action} not found`;
    if (!parserFn) return `${parser} not found`;
    const literals = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && (n.value === "existing:" || n.value === "new:")) literals.push(n);
    });
    if (literals.length === 0) return "the encoding's prefixes are spelled nowhere";
    if (literals.some((n) => !contains(parserFn, n))) return `the encoding is read outside ${parser}`;

    const first = firstSideEffect(actionFn, rel, ctx);
    const parses = [];
    walk(actionFn, (n) => {
        if (n.type === "CallExpression" && calleeName(n) === parser) parses.push(n);
    });
    if (parses.length === 0) return `${action} never calls ${parser}`;
    if (parses.some((n) => insideTry(actionFn, n))) return `${action} reads the choice inside its try`;
    if (first && parses.some((n) => n.start > first.start)) return `${action} reads the choice after a side effect`;

    // A set of the request's own quotations, and an `if` asking it that leaves.
    const sets = new Set();
    walk(actionFn, (n) => {
        if (
            n.type === "VariableDeclarator" &&
            n.id?.type === "Identifier" &&
            n.init?.type === "NewExpression" &&
            n.init.callee?.name === "Set"
        ) {
            let fromRowIds = false;
            walk(n.init, (m) => {
                if (m.type === "MemberExpression" && !m.computed && m.property?.name === "quotationRowIds") fromRowIds = true;
            });
            if (fromRowIds) sets.add(n.id.name);
        }
    });
    if (sets.size === 0) return `${action} builds no set of the request's own quotations`;
    let judged = false;
    walk(actionFn, (n) => {
        if (judged || n.type !== "IfStatement") return;
        let asks = false;
        walk(n.test, (m) => {
            if (
                m.type === "CallExpression" &&
                m.callee?.type === "MemberExpression" &&
                m.callee.property?.name === "has" &&
                m.callee.object?.type === "Identifier" &&
                sets.has(m.callee.object.name)
            ) {
                asks = true;
            }
        });
        if (!asks || !endsInExit(n.consequent)) return;
        if (insideTry(actionFn, n)) return;
        if (first && n.start > first.start) return;
        judged = true;
    });
    return judged ? null : `${action} never refuses a quotation outside the request's own before it writes`;
}

// ── the run ──────────────────────────────────────────────────────────────────

export function run({ check, assert, log }) {
    const files = [...jsFilesUnder("app"), ...jsFilesUnder("lib")];
    const parsed = new Map(files.map((rel) => [rel, parseFile(rel)]));
    const ctx = deriveWriters(parsed);

    // THE DERIVATION, SEEN FINDING WHAT IT IS ABOUT. Named by hand rather than derived,
    // so a derivation that finds nothing, or everything, fails here — a second path to
    // the answer has to be a second path.
    log("THE SIDE-EFFECT DERIVATION — sees the writers it must and none of the readers:");
    const isWriter = (rel, name) => Boolean(ctx.get(rel)?.writers.has(name));
    const mustWrite = [
        ["lib/airtable/purchaseRequests.js", "updatePR"],
        ["lib/airtable/purchaseRequests.js", "createPR"],
        ["lib/airtable/quotations.js", "createQuotation"],
        ["lib/airtable/prSigners.js", "updateSigner"],
        ["app/prs/new/actions.js", "persistPRFromForm"],
        ["app/prs/new/actions.js", "destroyChildren"],
        ["lib/poGeneration.js", "generatePOForApprovedPR"],
        ["lib/email.js", "sendPOToVendorEmail"],
        ["lib/notifications.js", "notifyCurrentTurn"],
        ["lib/blobIngest.js", "confirmIngestThenDelete"],
        ["app/pos/[poId]/actions.js", "syncPRStatusToPOSigned"],
    ];
    for (const [rel, name] of mustWrite) assert(`  ${rel} ${name} is a writer`, isWriter(rel, name));
    const mustRead = [
        ["lib/airtable/purchaseRequests.js", "getPRById"],
        ["lib/airtable/purchaseRequests.js", "getPRByRecordId"],
        ["lib/airtable/prItems.js", "getItemsByPR"],
        ["app/prs/new/actions.js", "findDuplicatePR"],
        ["app/prs/new/actions.js", "resumedDraft"],
        ["app/prs/[prId]/actions.js", "loadPRContext"],
        ["lib/prDraft.js", "loadPRDraft"],
    ];
    for (const [rel, name] of mustRead) assert(`  ${rel} ${name} is not`, !isWriter(rel, name));

    // ── 1: the inventory ───────────────────────────────────────────────────────
    log("");
    log("THE INVENTORY — every call that turns an id into a request is classified:");
    const byKey = new Map();
    const unclassified = [];
    let callsSeen = 0;
    for (const [rel, { ast, source }] of parsed) {
        if (rel === "lib/airtable/purchaseRequests.js") continue; // where the readers are defined
        const fns = namedFunctions(ast);
        walk(ast, (n) => {
            if (n.type !== "CallExpression" || !READERS.has(calleeName(n))) return;
            callsSeen += 1;
            const fn = enclosingNamed(fns, n);
            const reader = calleeName(n);
            const row = INVENTORY.find((r) => r.file === rel && r.fn === fn?.name && r.reader === reader);
            if (!row) {
                unclassified.push(`${rel}:${lineOf(source, n)} ${fn?.name ?? "(no named function)"} → ${reader}`);
                return;
            }
            const key = `${rel}#${row.fn}#${reader}`;
            if (!byKey.has(key)) byKey.set(key, { row, fnNode: fn.node, reads: [], rel, ast });
            byKey.get(key).reads.push(n);
        });
    }
    check("every call is classified here", unclassified.join("; "), "");
    const stale = INVENTORY.filter((r) => !byKey.has(`${r.file}#${r.fn}#${r.reader}`)).map((r) => `${r.file}#${r.fn}`);
    check("  and every row still names a call", stale.join(", "), "");
    assert("  and the walk found the calls it is about", callsSeen >= INVENTORY.length);

    // ── 2: each row holds ──────────────────────────────────────────────────────
    log("");
    log("THE ROWS — a write path asks first, a read path writes nothing:");
    for (const { row, fnNode, reads, rel, ast } of byKey.values()) {
        const label = `  ${row.fn} → ${row.reader} (${row.kind}: ${row.why})`;
        if (row.kind === "judged") {
            const reason = judgedRefusal({ fnNode, reads, row, rel, ctx });
            assert(`${label}${reason ? ` — ${reason}` : ""}`, reason === null);
        } else if (row.kind === "read") {
            const effect = firstSideEffect(fnNode, rel, ctx);
            assert(
                `${label}${effect ? ` — it calls ${calleeName(effect) ?? "a writer"}` : ""}`,
                effect === null
            );
        } else if (row.kind === "wrapped") {
            let wrapped = false;
            for (const node of ast.body) {
                const decl = node.type === "ExportNamedDeclaration" ? node.declaration : null;
                if (decl?.type !== "VariableDeclaration") continue;
                for (const d of decl.declarations) {
                    const init = d.init;
                    if (init?.type !== "CallExpression" || !ROLE_WRAPPERS.has(init.callee?.name)) continue;
                    const handler = init.arguments.at(-1);
                    if (handler?.type === "Identifier" && handler.name === row.fn) wrapped = true;
                }
            }
            assert(`${label}${wrapped ? "" : " — no role-wrapped export hands it the request"}`, wrapped);
        } else {
            assert(label, row.kind === "server" && Boolean(row.why));
        }
    }

    // ANTI-VACUITY for the judged rule — each clause seen refusing its own mutant, and
    // the shape the actions use seen passing, on planted sources the derivation can
    // reach (`updatePR` is a writer here because it writes `base(...)` itself).
    log("");
    log("the judged rule refuses each way of getting it wrong:");
    const plant = (label, body) => {
        const rel = `planted/${label}.js`;
        const src =
            "function base() {}\n" +
            "async function updatePR(id, f) { return base('Purchase Requests').update(id, f); }\n" +
            "async function getPRByRecordId(id) { return null; }\n" +
            "function isMine(user, pr) { return false; }\n" +
            `export async function act(user, formData) {\n${body}\n}\n`;
        const p = parseSource(src, rel);
        const local = deriveWriters(new Map([[rel, p]]));
        const fns = namedFunctions(p.ast);
        const fnNode = fns.find((f) => f.name === "act").node;
        const reads = [];
        walk(fnNode, (n) => {
            if (n.type === "CallExpression" && calleeName(n) === "getPRByRecordId") reads.push(n);
        });
        return judgedRefusal({ fnNode, reads, row: { judgment: "isMine", id: "id" }, rel, ctx: local });
    };
    const good = plant(
        "good",
        '  const id = formData.get("id");\n  const pr = await getPRByRecordId(id);\n' +
            '  if (!isMine(user, pr)) return { error: "no" };\n  await updatePR(pr.id, {});'
    );
    check("  the shape the actions use passes", good, null);
    const cases = {
        "never asks": '  const pr = await getPRByRecordId(formData.get("id"));\n  await updatePR(pr.id, {});',
        "asks after it writes":
            '  const pr = await getPRByRecordId(formData.get("id"));\n  await updatePR(pr.id, {});\n' +
            '  if (!isMine(user, pr)) return { error: "no" };',
        "asks inside a try":
            '  const pr = await getPRByRecordId(formData.get("id"));\n' +
            '  try { if (!isMine(user, pr)) throw new Error("no"); await updatePR(pr.id, {}); } catch { return {}; }',
        "throws the answer away":
            '  const pr = await getPRByRecordId(formData.get("id"));\n  isMine(user, pr);\n  await updatePR(pr.id, {});',
        "asks about something else":
            '  const pr = await getPRByRecordId(formData.get("id"));\n' +
            '  if (!isMine(user, null)) return { error: "no" };\n  await updatePR(pr.id, {});',
        "reads the record first":
            '  const pr = await getPRByRecordId(formData.get("id"));\n  const late = pr.status;\n' +
            '  if (!isMine(user, pr)) return { error: "no" };\n  await updatePR(pr.id, { late });',
        "computes about the id first":
            '  const id = formData.get("id");\n  const dup = find(id);\n  const pr = await getPRByRecordId(id);\n' +
            '  if (!isMine(user, pr)) return { error: dup };\n  await updatePR(pr.id, {});',
    };
    for (const [what, body] of Object.entries(cases)) {
        assert(`  a path that ${what} is refused`, plant(what.replaceAll(" ", "-"), body) !== null);
    }
    // And the classifier sees a call nobody has classified, which is how a new path
    // is made to answer the question at all.
    const newPath = parseSource(
        "export async function sneakAction(formData) { const pr = await getPRByRecordId(formData.get('x')); }\n",
        "planted/new.js"
    );
    let unseen = 0;
    walk(newPath.ast, (n) => {
        if (n.type === "CallExpression" && READERS.has(calleeName(n))) unseen += 1;
    });
    check("  and a new reader call is seen, so an unclassified path has nowhere to hide", unseen, 1);

    // ── 3: the quotation an edit turn links ────────────────────────────────────
    log("");
    log("THE CHILD ID — a quotation Edit and continue links is one of the request's own:");
    const editRel = "app/prs/[prId]/actions.js";
    const editReason = quotationChoiceRefusal({ ast: parsed.get(editRel).ast, rel: editRel, ctx });
    assert(`  editAndContinueAction${editReason ? ` — ${editReason}` : ""}`, editReason === null);
    const plantEdit = (label, body) => {
        const rel = `planted/${label}.js`;
        const src =
            "function base() {}\n" +
            "async function updateItem(id, f) { return base('PR Items').update(id, f); }\n" +
            "function readQuotationChoice(v) { return v.startsWith('existing:') ? { existingId: v.slice('existing:'.length) } " +
            ": v.startsWith('new:') ? { newIndex: 0 } : {}; }\n" +
            `export async function editAndContinueAction(pr, items) {\n${body}\n}\n`;
        const p = parseSource(src, rel);
        return quotationChoiceRefusal({ ast: p.ast, rel, ctx: deriveWriters(new Map([[rel, p]])) });
    };
    const judgedBody =
        "  const own = new Set(pr.quotationRowIds);\n  const plan = new Map();\n" +
        "  for (const it of items) { const c = readQuotationChoice(it.q); " +
        "if (c.existingId && !own.has(c.existingId)) return { error: 'no' }; plan.set(it.id, c); }\n" +
        "  try { for (const [id, c] of plan) await updateItem(id, { q: c.existingId }); } catch { return {}; }";
    check("  the shape the action uses passes", plantEdit("q-good", judgedBody), null);
    assert(
        "  an edit that never refuses a foreign quotation is refused",
        plantEdit(
            "q-none",
            "  const plan = new Map();\n  for (const it of items) plan.set(it.id, readQuotationChoice(it.q));\n" +
                "  try { for (const [id, c] of plan) await updateItem(id, { q: c.existingId }); } catch { return {}; }"
        ) !== null
    );
    assert(
        "  and one that reads the choice inside the try",
        plantEdit(
            "q-late",
            "  const own = new Set(pr.quotationRowIds);\n" +
                "  try { for (const it of items) { const c = readQuotationChoice(it.q); " +
                "if (c.existingId && !own.has(c.existingId)) return { error: 'no' }; await updateItem(it.id, { q: c.existingId }); } } catch { return {}; }"
        ) !== null
    );
    assert(
        "  and one that asks a set that is not the request's",
        plantEdit("q-other", judgedBody.replace("pr.quotationRowIds", "pr.itemRowIds")) !== null
    );
}

if (isMain(import.meta.url)) standalone(title, run);
