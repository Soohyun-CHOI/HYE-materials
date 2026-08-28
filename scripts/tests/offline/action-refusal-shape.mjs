// One rejection shape per admin Server Action, and it follows the call site (#185).
//
// Every `withAdminAction` export passes its refusal as a thunk, so each one chose
// independently and a new action copied whichever neighbour it was pasted from. #185
// settled the rule: **an action whose every call site BINDS the return value refuses
// by returning `{ error }`; an action any call site invokes without binding throws.**
//
// THREE BINDINGS EXIST AND TWO OF THEM OBSERVE. `useActionState(action, init)` makes
// the return `state`; `await action(...)` in a client handler makes it a value; a
// bare `<form action={action}>` DISCARDS it. That third one is why the rule is not
// "a form returns" — `/admin/jobs/new` is a form and cannot see a returned refusal,
// because its page is a Server Component handing the action straight to the element.
//
// THE RULE IS A CONJUNCTION, and the disagreement case is part of it: one
// non-binding caller makes the rule say throw, which costs the binding caller its
// inline message. That is the signal to change the caller, not the shape.
//
// WHAT THIS FILE HOLDS, IN THREE ASSERTIONS AND ONE QUIET MUTANT.
//
//   1. THE INVENTORY IS COMPLETE. Every `withAdminAction` export under `app/` is a
//      key here, and every key is an export — `mail-money.mjs`'s shape for the same
//      reason. A tenth action fails this file until somebody classifies it.
//
//   2. THE RECORDED SHAPE IS THE THUNK'S ACTUAL SHAPE, read off the AST. This is
//      what stops the inventory becoming a document beside the code: an entry saying
//      `return` over a thunk that throws fails.
//
//   3. THE SHAPE THE RULE DERIVES FROM THE CALL SITES IS THE SHAPE ON DISK. The
//      bindings are found by walking `app/`, so the rule is applied rather than
//      restated.
//
//   4. THE QUIET MUTANT — a returned refusal nobody renders. A throw at least reaches
//      the framework's own page; an ignored return leaves no trace at all, so the
//      refusal simply looks like nothing happened. Every observing call site must
//      have a path from the bound value's `.error` into JSX.
//
// A THROWN MESSAGE IS NOT SCREEN COPY IN THIS APP, which is the premise assertion 4
// rests on and is checked here rather than assumed: `app/` contains no `error.js` and
// no `global-error.js`, so nothing renders one. `scripts/screen-strings.mjs` stopped
// collecting thrown messages from `"use server"` files for the same reason. **If an
// error boundary is ever added, those thrown refusals become copy the moment it
// lands** — assertion 5 fails that day, which is the point of asserting a premise
// rather than writing it down.
//
// NOT `offline/authz-structure.mjs`'s JOB, and that file is untouched. It asks
// whether an export is gated at all — the property #147 made structural, which no
// shape here can weaken, since `createFlagGuard` calls the thunk INSTEAD of the
// handler whatever the thunk returns. This file asks what the refusal then looks
// like to a reader.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { listJsFiles, parseFile, parseSource, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One rejection shape per admin Server Action, following the call site (#185)";

const APP = "app";

/**
 * Every `withAdminAction` export, its refusal shape, and why the rule gives it that.
 *
 * `binding` is what the call sites do, and it is the reason rather than decoration:
 * assertion 3 derives the shape from the tree and compares.
 */
const ACTIONS = {
    createDisciplineAction: {
        text: "Not authorized.",
        file: "app/admin/disciplines/new/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "DisciplineForm.js binds it; the box also carries its two validation refusals",
    },
    createJobAction: {
        text: "Not authorized",
        file: "app/admin/jobs/new/actions.js",
        shape: "throw",
        binding: "form-action",
        why: "a Server Component page hands it to `<form action>`, which discards the return",
    },
    createVendorAction: {
        text: "Not authorized",
        file: "app/admin/vendors/new/actions.js",
        shape: "throw",
        binding: "form-action",
        why: "the same page shape as its Jobs sibling, and the same discarded return",
    },
    updatePaidAction: {
        text: "Only an Admin can update payment status.",
        file: "app/invoices/[invoiceId]/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "PaidForm.js binds it; the box is where the Paid Date refusal already lands",
    },
    updateInvoiceAction: {
        text: "Not authorized.",
        file: "app/invoices/[invoiceId]/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "the edit form binds it and renders state.error above the fields",
    },
    deleteInvoiceAction: {
        text: "Only an Admin can delete invoices.",
        file: "app/invoices/[invoiceId]/actions.js",
        shape: "return",
        binding: "awaited",
        why: "DeleteInvoiceButton.js awaits it and puts res.error into its own state",
    },
    createInvoiceAction: {
        text: "Not authorized.",
        file: "app/invoices/new/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "InvoiceForm.js binds it as `state` and renders the error at the foot",
    },
    createDirectPurchaseAction: {
        text: "Not authorized.",
        file: "app/invoices/new/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "the same form binds it separately as `dpState` for the modal",
    },
    generatePOAction: {
        text: "Only an Admin can generate a PO.",
        file: "app/prs/[prId]/actions.js",
        shape: "return",
        binding: "useActionState",
        why: "two call sites, the request page and the /pos strip, and both bind and render",
    },
};

/** Bindings that can observe a return. The third, `form-action`, cannot. */
const OBSERVING = new Set(["useActionState", "awaited"]);

const appFiles = () => listJsFiles(repoPath(APP)).map((abs) => abs.split("\\").join("/"));

/** `app/...` from an absolute path, so a finding names what a reader can open. */
function relOf(abs) {
    const i = abs.lastIndexOf(`/${APP}/`);
    return i >= 0 ? abs.slice(i + 1) : abs;
}

/** Every name exported as `withAdminAction(...)`, from one source. */
export function wrappedActionNames(ast) {
    const names = [];
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        const init = node.init;
        if (init?.type !== "CallExpression") return;
        if (init.callee?.name !== "withAdminAction") return;
        if (node.id?.type === "Identifier") names.push(node.id.name);
    });
    return names;
}

/**
 * The shape of a `withAdminAction` export's refusal thunk, read off its first
 * argument: `throw` if the thunk's body throws, `return` if it yields an object
 * carrying an `error` key, `unknown` otherwise.
 *
 * `unknown` is a real answer rather than a fallback — an entry can only be right by
 * matching one of the two, so a third shape fails assertion 2 instead of passing it.
 */
export function refusalShape(ast, actionName) {
    let shape = null;
    let text = null;
    walk(ast, (node) => {
        if (shape) return;
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== actionName) return;
        const init = node.init;
        if (init?.type !== "CallExpression" || init.callee?.name !== "withAdminAction") return;
        const thunk = init.arguments?.[0];
        if (!thunk) return;
        let throws = false;
        let returnsError = false;
        walk(thunk, (n) => {
            if (n.type === "ThrowStatement") throws = true;
            if (n.type === "NewExpression" && n.callee?.name === "Error") {
                const arg = n.arguments?.[0];
                if (arg?.type === "Literal" && typeof arg.value === "string") text = arg.value;
            }
            if (n.type === "ObjectExpression") {
                for (const prop of n.properties || []) {
                    if ((prop.key?.name ?? prop.key?.value) !== "error") continue;
                    returnsError = true;
                    if (prop.value?.type === "Literal" && typeof prop.value.value === "string") {
                        text = prop.value.value;
                    }
                }
            }
        });
        shape = throws ? "throw" : returnsError ? "return" : "unknown";
    });
    return { shape, text };
}

/**
 * Every call site of one action across `app/`, with how it binds the return.
 *
 * Matched on the identifier's NAME rather than through the import graph, which is
 * sound here because every one of these is imported under its export name — and
 * assertion 3's own anti-vacuity is that each action is found at least once, so a
 * rename that broke the match would report zero rather than pass.
 */
export function callSites(actionName, files) {
    const sites = [];
    for (const abs of files) {
        const rel = relOf(abs);
        if (rel === ACTIONS[actionName]?.file) continue; // the definition, not a call
        let ast, source;
        try {
            ({ ast, source } = parseFile(rel));
        } catch {
            continue;
        }
        if (!source.includes(actionName)) continue;
        walk(ast, (node) => {
            // `useActionState(ACTION, init)` — the return becomes `state`.
            if (
                node.type === "CallExpression" &&
                node.callee?.name === "useActionState" &&
                node.arguments?.[0]?.name === actionName
            ) {
                sites.push({ file: rel, binding: "useActionState", node, ast });
            }
            // `<form action={ACTION}>` — the return goes nowhere.
            if (
                node.type === "JSXAttribute" &&
                node.name?.name === "action" &&
                node.value?.type === "JSXExpressionContainer" &&
                node.value.expression?.name === actionName
            ) {
                sites.push({ file: rel, binding: "form-action", node, ast });
            }
            // `await ACTION(...)` — the return is a value in hand.
            if (
                node.type === "AwaitExpression" &&
                node.argument?.type === "CallExpression" &&
                node.argument.callee?.name === actionName
            ) {
                sites.push({ file: rel, binding: "awaited", node, ast });
            }
        });
    }
    return sites;
}

/** Does `name.error` (or `name?.error`) appear anywhere inside JSX in this file? */
function renderedInJsx(ast, name) {
    let found = false;
    walk(ast, (container) => {
        if (found) return;
        if (container.type !== "JSXExpressionContainer") return;
        walk(container, (n) => {
            if (n.type !== "MemberExpression") return;
            if (n.object?.name !== name) return;
            if ((n.property?.name ?? n.property?.value) === "error") found = true;
        });
    });
    return found;
}

/** Every identifier a `setX(...)` in this file is handed, keyed by the state name. */
function stateFromSetter(ast, sourceName) {
    // `setError(res.error)` → the state `error` carries the refusal. The pair is
    // found by the `set` prefix React's own convention uses, which is what every
    // `useState` in this repo follows.
    const carried = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee?.name || "";
        if (!/^set[A-Z]/.test(callee)) return;
        const arg = node.arguments?.[0];
        if (!arg) return;
        let reads = false;
        walk(arg, (n) => {
            if (
                n.type === "MemberExpression" &&
                n.object?.name === sourceName &&
                (n.property?.name ?? n.property?.value) === "error"
            ) {
                reads = true;
            }
        });
        if (reads) carried.add(callee.slice(3, 4).toLowerCase() + callee.slice(4));
    });
    return carried;
}

/** Is the identifier rendered anywhere inside JSX in this file? */
function identifierInJsx(ast, name) {
    let found = false;
    walk(ast, (container) => {
        if (found) return;
        if (container.type !== "JSXExpressionContainer") return;
        walk(container, (n) => {
            if (n.type === "Identifier" && n.name === name) found = true;
        });
    });
    return found;
}

/** The name a `useActionState(...)` destructures its state into. */
function boundStateName(site, ast) {
    let name = null;
    walk(ast, (node) => {
        if (name) return;
        if (node.type !== "VariableDeclarator") return;
        if (node.init !== site.node) return;
        if (node.id?.type === "ArrayPattern") name = node.id.elements?.[0]?.name ?? null;
    });
    return name;
}

/** The name an `await ACTION(...)` is assigned to. */
function boundAwaitName(site, ast) {
    let name = null;
    walk(ast, (node) => {
        if (name) return;
        if (node.type !== "VariableDeclarator") return;
        if (node.init !== site.node) return;
        if (node.id?.type === "Identifier") name = node.id.name;
    });
    return name;
}

/** Every `error.js` / `global-error.js` under `app/`, which is the premise. */
function errorBoundaries(dir = repoPath(APP), out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) errorBoundaries(full, out);
        else if (/^(global-)?error\.jsx?$/.test(entry)) out.push(relOf(full.split("\\").join("/")));
    }
    return out;
}

export function run({ check, assert, log }) {
    const files = appFiles();
    assert(`walked ${files.length} files under ${APP}/`, files.length > 60);

    // ── 1. the inventory is complete, both ways ─────────────────────────────
    log("THE QUIET MUTANT — an action this file has never heard of:");
    const declared = [];
    for (const abs of files) {
        const rel = relOf(abs);
        try {
            declared.push(...wrappedActionNames(parseFile(rel).ast));
        } catch {
            /* a parse failure is reported by the walk count above */
        }
    }
    declared.sort();
    const classified = Object.keys(ACTIONS).sort();
    check("every withAdminAction export is classified here", declared.join(","), classified.join(","));
    assert("  and there are exports to classify at all", declared.length > 0);
    // ANTI-VACUITY: the walker has to be seen finding one the table does not know, or
    // "the lists match" is what an empty walk reports.
    const planted = wrappedActionNames(
        parseSource(
            "export const createJobAction = withAdminAction(a, b);\n" +
                "export const deleteEverythingAction = withAdminAction(a, b);\n"
        ).ast
    );
    assert("the walker finds an export that is not in the table", planted.includes("deleteEverythingAction"));
    assert(
        "  and a table missing it would not match",
        planted.sort().join(",") !== classified.join(",")
    );

    // ── 2. the recorded shape is the thunk's actual shape ───────────────────
    log("");
    log("each recorded shape is what the refusal thunk really does:");
    const wrong = [];
    for (const [name, entry] of Object.entries(ACTIONS)) {
        const { shape, text } = refusalShape(parseFile(entry.file).ast, name);
        if (shape !== entry.shape) wrong.push(`${name}: recorded ${entry.shape}, found ${shape}`);
        // THE WORDING TOO, because a RETURNED refusal is screen copy and this is the
        // only pin it can have: `offline/screen-briefs.mjs`'s PINNED needs a sentence
        // in a loadable `*_COPY` constant, and these are literals inside a
        // `"use server"` action, which that file structurally cannot reach (#303 hit
        // the same wall). A thrown one is pinned here as well, for the opposite
        // reason — it is developer-facing, so nothing else would ever notice it move.
        if (text !== entry.text) wrong.push(`${name}: recorded ${JSON.stringify(entry.text)}, found ${JSON.stringify(text)}`);
    }
    check(
        `entries whose shape or wording disagrees with the code${wrong.length ? ` (${wrong.join("; ")})` : ""}`,
        wrong.length,
        0
    );
    // ANTI-VACUITY: the classifier has to tell the two apart on known input.
    const probe = parseSource(
        'export const aThrower = withAdminAction(() => { throw new Error("no"); }, h);\n' +
            'export const aReturner = withAdminAction(() => ({ error: "no" }), h);\n' +
            "export const neither = withAdminAction(() => null, h);\n"
    ).ast;
    check("  the classifier reads a throwing thunk", refusalShape(probe, "aThrower").shape, "throw");
    check("  and a returning one", refusalShape(probe, "aReturner").shape, "return");
    check("  and refuses to guess at a third", refusalShape(probe, "neither").shape, "unknown");
    check("  and it reads the wording off either", refusalShape(probe, "aThrower").text, "no");
    check("    including a returned one", refusalShape(probe, "aReturner").text, "no");

    // ── 3. the rule, applied to the call sites rather than restated ─────────
    log("");
    log("the shape the rule derives from the call sites is the shape on disk:");
    const sitesByAction = new Map();
    for (const name of Object.keys(ACTIONS)) sitesByAction.set(name, callSites(name, files));
    const uncalled = [...sitesByAction].filter(([, s]) => s.length === 0).map(([n]) => n);
    check(
        `actions with no call site found${uncalled.length ? ` (${uncalled.join(", ")})` : ""}`,
        uncalled.length,
        0
    );
    const misruled = [];
    for (const [name, entry] of Object.entries(ACTIONS)) {
        const sites = sitesByAction.get(name);
        const allObserve = sites.every((s) => OBSERVING.has(s.binding));
        const ruleSays = allObserve ? "return" : "throw";
        const bindings = [...new Set(sites.map((s) => s.binding))].sort().join("+");
        if (ruleSays !== entry.shape) {
            misruled.push(`${name}: bindings ${bindings} → ${ruleSays}, but it ${entry.shape}s`);
        }
        if (bindings !== entry.binding) {
            misruled.push(`${name}: recorded binding ${entry.binding}, found ${bindings}`);
        }
    }
    check(
        `actions whose shape the rule does not give${misruled.length ? ` (${misruled.join("; ")})` : ""}`,
        misruled.length,
        0
    );
    // ANTI-VACUITY: the three bindings have to be told apart, and the non-observing
    // one has to be seen, or "every site observes" is what a blind walk reports.
    const seen = new Set([...sitesByAction.values()].flat().map((s) => s.binding));
    assert("all three bindings are found in the tree", ["useActionState", "form-action", "awaited"].every((b) => seen.has(b)));
    assert("  and one of them does not observe", !OBSERVING.has("form-action"));

    // ── 4. no returned refusal goes unrendered ──────────────────────────────
    log("");
    log("every returned refusal has a path onto the screen:");
    const unrendered = [];
    for (const [name, entry] of Object.entries(ACTIONS)) {
        if (entry.shape !== "return") continue;
        for (const site of sitesByAction.get(name)) {
            // THE AST THE SITE WAS FOUND IN, not a fresh parse of the same file: the
            // two lookups below match a declarator by node IDENTITY, and re-parsing
            // makes every comparison false. The first version did exactly that and
            // reported all eight as unrendered — a check failing for its own reason,
            // which is the failure mode an anti-vacuity assertion on a live file does
            // not catch, since that one passed throughout.
            const ast = site.ast;
            let ok = false;
            if (site.binding === "useActionState") {
                const bound = boundStateName(site, ast);
                ok = Boolean(bound) && renderedInJsx(ast, bound);
            } else if (site.binding === "awaited") {
                const bound = boundAwaitName(site, ast);
                const carried = bound ? stateFromSetter(ast, bound) : new Set();
                ok = [...carried].some((stateName) => identifierInJsx(ast, stateName));
            }
            if (!ok) unrendered.push(`${name} at ${site.file} (${site.binding})`);
        }
    }
    check(
        `returned refusals with no rendering path${unrendered.length ? ` (${unrendered.join("; ")})` : ""}`,
        unrendered.length,
        0
    );
    // ANTI-VACUITY, both halves: the renderer detector has to say yes on a real file
    // and no on one where the render is removed.
    const paidForm = parseFile("app/invoices/[invoiceId]/PaidForm.js").ast;
    assert("the detector sees a real render", renderedInJsx(paidForm, "state"));
    assert("  and says no for a name nothing renders", !renderedInJsx(paidForm, "nothingRendersThis"));

    // ── 5. the premise: a thrown refusal is not copy in this app ────────────
    log("");
    log("a thrown refusal reaches no boundary this repository owns:");
    const boundaries = errorBoundaries();
    check(
        `error boundaries under ${APP}/${boundaries.length ? ` (${boundaries.join(", ")})` : ""}`,
        boundaries.length,
        0
    );
    log("  so a throwing action's message is developer-facing, not screen copy");
    log("  — add an error.js and this assertion fails, which is when the rule needs re-reading");
    // ANTI-VACUITY: the finder has to be able to see a file of that name.
    assert("the boundary finder reaches app/ at all", existsSync(repoPath("app/layout.js")));
    assert(
        "  and would report one that exists",
        /^(global-)?error\.jsx?$/.test("error.js") && /^(global-)?error\.jsx?$/.test("global-error.js")
    );

    log("");
    log(`  ${classified.length} actions classified, ${[...sitesByAction.values()].flat().length} call sites read`);
}

if (isMain(import.meta.url)) standalone(title, run);
