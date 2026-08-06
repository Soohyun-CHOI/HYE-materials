// The Airtable operation counter (#190) — its classifier, its guards, and the
// dependency version it was written against.
//
// WHY THE VERSION PIN IS IN THIS TIER AND NOT LEFT TO THE RUNTIME THROW.
// installOpsCounter() throws when it cannot find airtable's request funnel, which
// makes a blind instrument an app that does not boot. But that throw fires at
// lib/airtable/client.js's MODULE LOAD, and this tier never loads that file — by
// construction, it is the file whose `Missing AIRTABLE_API_KEY` defines the tier
// boundary. So a PR bumping `airtable` would pass CI green and land the throw on
// the first production request instead. Comparing the pin against package.json
// here turns that runtime mine into a build failure.
//
// WHAT A MATCHING PIN PROVES: that somebody looked. NOT that the wrapper still
// works. Only scripts/tests/verify-airtable-ops-190.mjs can say that, because
// only it issues a real request and watches the counter move. When this check
// fails, the remedy is to re-read node_modules/airtable/lib/{base,table,query,
// record}.js, re-run that script, and then move the constant.
//
// The classifier is pinned against the six request shapes those four files build.
// They are enumerable from the dependency's source, which is what makes this a
// check rather than a guess — see the table in lib/airtableOps.js.

import { readFileSync } from "fs";
import { join, relative } from "path";
import {
    callsTo,
    listJsFiles,
    parseFile,
    REPO_ROOT,
    repoPath,
    resolveFunction,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import {
    PINNED_AIRTABLE_VERSION,
    UNLABELED,
    classifyRequest,
    currentOpsLabel,
    installOpsCounter,
    recordOperation,
    resetOps,
    snapshot,
    withOpsLabel,
} from "../../../lib/airtableOps.js";

export const title = "Airtable operation counter — classifier, guards, version pin (#190)";

// Every shape airtable@0.12.2 builds, with the file and function that builds it.
// A `get` with no record id is one PAGE of a select, which is the whole reason
// this layer was chosen over #19's.
const SHAPES = [
    ["query.js:eachPage (a select page)", "get", "/Purchase%20Requests", "list", "Purchase Requests"],
    ["query.js:eachPage (URL over 16kb)", "post", "/Purchase%20Requests/listRecords", "list", "Purchase Requests"],
    ["table.js:_listRecords (deprecated)", "get", "/PO%20Items/", "list", "PO Items"],
    ["table.js:_createRecords", "post", "/PO%20Items/", "create", "PO Items"],
    ["table.js:_updateRecords (batch)", "patch", "/Materials/", "update-batch", "Materials"],
    ["table.js:_destroyRecord (batch)", "delete", "/Materials", "destroy-batch", "Materials"],
    ["record.js:fetch", "get", "/Invoices/recABCDEFGHIJKLMN", "find", "Invoices"],
    ["record.js:patchUpdate", "patch", "/Invoices/recABCDEFGHIJKLMN", "update", "Invoices"],
    ["record.js:putUpdate", "put", "/Invoices/recABCDEFGHIJKLMN", "update", "Invoices"],
    ["record.js:destroy", "delete", "/Invoices/recABCDEFGHIJKLMN", "destroy", "Invoices"],
];

function fakeFunctor() {
    // Stands in for Airtable.base()'s functor: what installOpsCounter needs is
    // `_base.runAction` plus the bound copy createFunctor puts on the functor.
    const calls = [];
    const instance = {
        runAction(method, path) {
            calls.push([method, path]);
        },
    };
    const functor = () => {};
    functor._base = instance;
    functor.runAction = instance.runAction.bind(instance);
    functor.calls = calls;
    return functor;
}

export async function run({ check, assert, log }) {
    // ── the classifier ──────────────────────────────────────────────────────
    for (const [where, method, path, kind, table] of SHAPES) {
        const got = classifyRequest(method, path);
        check(`${where}: ${method.toUpperCase()} ${path}`, `${got.kind} on ${got.table}`, `${kind} on ${table}`);
    }

    // An unknown shape must be VISIBLE, not folded into a plausible neighbor: a
    // path form a future airtable adds should read as a number nobody can
    // explain rather than quietly inflate `find`.
    check("an unrecognized sub-resource is unknown", classifyRequest("get", "/Invoices/recABC/comments").kind, "unknown");
    check("an unrecognized verb is unknown", classifyRequest("head", "/Invoices").kind, "unknown");
    check("a non-record second segment is unknown", classifyRequest("get", "/Invoices/somethingElse").kind, "unknown");
    check("the table name is URL-decoded", classifyRequest("get", "/Invoice-PO%20Link").table, "Invoice-PO Link");

    // ── the install guard ───────────────────────────────────────────────────
    // A counter that cannot see anything must fail loudly. This is the property
    // #19's `> 0` assertion buys for its own instrument; here it is structural.
    let threw = false;
    try {
        installOpsCounter({});
    } catch {
        threw = true;
    }
    assert("installOpsCounter throws when the funnel is missing", threw);

    threw = false;
    try {
        installOpsCounter({ _base: { runAction: "not a function" } });
    } catch {
        threw = true;
    }
    assert("and throws when runAction is not callable", threw);

    // ── the double-wrap guard ───────────────────────────────────────────────
    // Wrapping the same object twice would count one operation as two, and a
    // doubled figure is plausible enough to go unnoticed. Next's dev server
    // re-evaluating a module is the way in, and the dev loop is exactly what
    // #190 wants a trustworthy number for.
    resetOps();
    const functor = fakeFunctor();
    installOpsCounter(functor);
    installOpsCounter(functor);
    installOpsCounter(functor);
    functor._base.runAction("get", "/Materials");
    check("three installs, one operation counted", snapshot().total, 1);
    check("and the underlying runAction still ran exactly once", functor.calls.length, 1);

    // The functor's own bound copy is wrapped too — createFunctor takes it
    // BEFORE the instance is patched, so a caller reaching it would otherwise
    // bypass the counter. Nothing in this repo calls it today; the guard is what
    // keeps that from mattering.
    resetOps();
    functor.runAction("get", "/Materials");
    check("the functor's bound copy is counted too", snapshot().total, 1);

    // ── labels ──────────────────────────────────────────────────────────────
    // THE `unlabeled` BUCKET MEANS TWO THINGS AND ONLY ONE OF THEM IS FINE: a
    // call site nobody has labeled yet (intended), or a lost AsyncLocalStorage
    // context (the instrument is broken). The second would drop EVERYTHING into
    // `unlabeled` and read exactly like the first, and the guards above cannot
    // see it — they only prove the counter counts, not that it attributes. So the
    // mechanism is asserted directly, including across an await boundary, which
    // is where a context would be lost if it were going to be.
    resetOps();
    check("outside a scope, operations are unlabeled", currentOpsLabel(), UNLABELED);

    await withOpsLabel("/prs", async () => {
        check("inside a scope, the label is current", currentOpsLabel(), "/prs");
        recordOperation("get", "/Purchase%20Requests");
        await new Promise((resolve) => setTimeout(resolve, 0));
        check("and survives an await boundary", currentOpsLabel(), "/prs");
        recordOperation("get", "/Users/recABCDEFGHIJKLMN");
    });

    let snap = snapshot();
    check("both operations landed under the label", snap.byLabel["/prs"], 2);
    assert("and none landed in the unlabeled bucket", snap.byLabel[UNLABELED] === undefined);
    check("the label does not leak out of its scope", currentOpsLabel(), UNLABELED);

    // THE OUTERMOST SCOPE WINS. Attribution answers "what did this SCREEN cost",
    // so a service-layer scope must not take the page's operations.
    resetOps();
    await withOpsLabel("/prs/[prId]", async () => {
        await withOpsLabel("inner-should-not-win", async () => {
            recordOperation("get", "/PR%20Items");
        });
    });
    snap = snapshot();
    check("a nested scope keeps the outer label", snap.byLabel["/prs/[prId]"], 1);
    assert("and the inner label records nothing", snap.byLabel["inner-should-not-win"] === undefined);

    // A scope that throws still attributes — every page and Server Action here
    // ends in redirect(), which throws.
    resetOps();
    await withOpsLabel("throwing-scope", async () => {
        recordOperation("get", "/Jobs");
        throw new Error("NEXT_REDIRECT");
    }).catch(() => {});
    check("a scope that throws still attributes its operations", snapshot().byLabel["throwing-scope"], 1);
    resetOps();

    // ── the version pin ────────────────────────────────────────────────────
    const pkg = JSON.parse(readFileSync(repoPath("package.json"), "utf8"));
    const declared = (pkg.dependencies?.airtable || "").replace(/^[\^~]/, "");
    check(
        `PINNED_AIRTABLE_VERSION matches package.json — re-read the funnel and re-run ` +
            `verify-airtable-ops-190.mjs before moving it`,
        PINNED_AIRTABLE_VERSION,
        declared
    );

    // The declared RANGE is not the INSTALLED version: `^0.12.2` admits 0.12.9,
    // whose funnel nobody has read. Checked when node_modules is present, which
    // it is in CI (this tier needs acorn).
    let installed = null;
    try {
        installed = JSON.parse(readFileSync(join(REPO_ROOT, "node_modules", "airtable", "package.json"), "utf8")).version;
    } catch {
        log("airtable is not installed — the pin was checked against package.json only");
    }
    if (installed) check("and matches the installed airtable", PINNED_AIRTABLE_VERSION, installed);

    // ── call-site shape ────────────────────────────────────────────────────
    const clientRel = "lib/airtable/client.js";
    const client = parseFile(clientRel);
    let installedInClient = false;
    walk(client.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "base") {
            if (callsTo(n, "installOpsCounter").length > 0) installedInClient = true;
        }
    });
    assert(`${clientRel} initializes base through installOpsCounter`, installedInClient);

    const importsCounter = client.ast.body.some(
        (n) =>
            n.type === "ImportDeclaration" &&
            /airtableOps$/.test(n.source.value) &&
            n.specifiers.some((s) => s.imported?.name === "installOpsCounter")
    );
    assert(`${clientRel} imports installOpsCounter from lib/airtableOps`, importsCounter);

    const install = resolveFunction(parseFile("lib/airtableOps.js").ast, "installOpsCounter");
    assert("installOpsCounter resolves", install !== null);
    let throwsInside = false;
    if (install) walk(install, (n) => { if (n.type === "ThrowStatement") throwsInside = true; });
    assert("installOpsCounter contains a throw, not a warning", throwsInside);

    // A LABEL MUST BE A LITERAL. The key space is what keeps the counter's Map
    // bounded, and a resolved path (`/prs/HYE-PR-260722-09`) rather than a route
    // template would make one row per record — turning the breakdown into a log
    // and the Map into a leak.
    const scanned = ["app", "lib"].flatMap((root) => listJsFiles(join(REPO_ROOT, root)));
    let labelSites = 0;
    let nonLiteral = 0;
    for (const abs of scanned) {
        const rel = toPosix(relative(REPO_ROOT, abs));
        if (rel === "lib/airtableOps.js") continue;
        let ast;
        try {
            ast = parseFile(rel).ast;
        } catch (err) {
            assert(`${rel} parses (an unparsed file is an unchecked file): ${err.message}`, false);
            continue;
        }
        for (const call of callsTo(ast, "withOpsLabel")) {
            labelSites += 1;
            const first = call.arguments[0];
            if (first?.type !== "Literal" || typeof first.value !== "string") {
                nonLiteral += 1;
                assert(`${rel}: withOpsLabel's label must be a string literal`, false);
            }
        }
    }
    check("every withOpsLabel label is a string literal", nonLiteral, 0);
    // Anti-vacuity: the loop above passes trivially if it found no call sites at
    // all, which is also what a renamed export would look like.
    assert(`the scan found real label call sites (${labelSites})`, labelSites > 0);

    // The private names #19 hooks must not reach production code. They are fine in
    // that script — it is a harness — and are what this module deliberately does
    // not depend on.
    //
    // ON THE AST, NOT THE TEXT, and the first version of this check is the reason:
    // a regex over the source failed lib/airtableOps.js for the paragraph in its
    // own header that explains why it does not hook those methods. Which is
    // _ast.mjs's rule read in the other direction — a comment must not be able to
    // FAIL a check any more than it can satisfy one.
    const PRIVATE = new Set(["_selectRecords", "_findRecordById"]);
    let privateNames = 0;
    for (const abs of scanned) {
        const rel = toPosix(relative(REPO_ROOT, abs));
        let ast;
        try {
            ast = parseFile(rel).ast;
        } catch {
            continue; // already reported by the parse loop above
        }
        walk(ast, (n) => {
            const named =
                (n.type === "Identifier" && PRIVATE.has(n.name)) ||
                (n.type === "MemberExpression" && PRIVATE.has(n.property?.name)) ||
                (n.type === "Literal" && PRIVATE.has(n.value));
            if (!named) return;
            privateNames += 1;
            assert(`${rel} must not depend on airtable's private table methods`, false);
        });
    }
    check("no production module hooks airtable's private table methods", privateNames, 0);
    log(`${scanned.length} files scanned under app/ and lib/`);
}

if (isMain(import.meta.url)) standalone(title, run);
