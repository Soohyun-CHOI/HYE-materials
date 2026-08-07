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
    DEFAULT_OPS_FILE,
    OPS_KEY_SEP,
    PINNED_AIRTABLE_VERSION,
    RECORD_KEYS,
    UNLABELED,
    buildProcessRecord,
    buildScopeRecord,
    classifyRequest,
    currentOpsLabel,
    formatRepeatedLine,
    formatScopeLine,
    installOpsCounter,
    processTag,
    recordOperation,
    resetOps,
    resolveOpsFile,
    snapshot,
    summarizeScope,
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

    // ── the summary-line baseline ───────────────────────────────────────────
    // `13 ops` on its own says nothing: whether 13 is high depends on how many
    // tables the render had to touch, and finding that out meant counting the rows
    // of the breakdown by hand. A page that needs a table should normally fetch it
    // once, so ops - tables is exactly the number of REPEAT reads. Pinned against
    // the real renders #190 measured, so these numbers and CLAUDE.md's cannot
    // drift apart.
    const countsFor = (entries) => {
        const m = new Map();
        for (const [table, kind, n] of entries) m.set(`${table}${OPS_KEY_SEP}${kind}`, n);
        return m;
    };

    const prs = summarizeScope(
        countsFor([
            ["Users", "find", 3],
            ["Purchase Requests", "list", 1],
            ["Jobs", "list", 1],
            ["Lines", "list", 1],
            ["Vendors", "list", 1],
        ])
    );
    check("/prs — ops", prs.ops, 7);
    check("/prs — tables", prs.tables, 5);
    check("/prs — repeats", prs.repeats, 2);
    check("/prs — the repeats are all on Users", prs.repeated.map((r) => r.table).join(","), "Users");

    const prDetail = summarizeScope(
        countsFor([
            ["Purchase Requests", "list", 1],
            ["Purchase Requests", "find", 5],
            ["Users", "find", 2],
            ["Vendors", "list", 1],
            ["Lines", "list", 1],
            ["Jobs", "list", 1],
            ["PR Signers", "find", 1],
            ["PR Items", "find", 1],
        ])
    );
    check("/prs/[prId] — ops", prDetail.ops, 13);
    check("/prs/[prId] — tables", prDetail.tables, 7);
    check("/prs/[prId] — repeats", prDetail.repeats, 6);
    check(
        "/prs/[prId] — repeats named worst-first",
        prDetail.repeated.map((r) => `${r.table} ${r.ops}`).join(", "),
        "Purchase Requests 6, Users 2"
    );

    // THE IDENTITY, not a coincidence of these two fixtures: ops - tables is the
    // sum over tables of (count - 1), so it counts repeat reads exactly.
    for (const [name, s] of [["/prs", prs], ["/prs/[prId]", prDetail]]) {
        check(`${name} — repeats is exactly ops minus tables`, s.repeats, s.ops - s.tables);
    }

    // A table name containing a space survives the key round trip, which is the
    // whole reason the separator is NUL rather than a space.
    assert(
        "a multi-word table name is not split by the key separator",
        prDetail.repeated.some((r) => r.table === "Purchase Requests")
    );

    const healthy = summarizeScope(countsFor([["Jobs", "list", 1], ["Users", "find", 1]]));
    check("a render with no repeats reports none", healthy.repeats, 0);
    check("and formats it positively", formatScopeLine("/", healthy).includes("no repeats"), true);
    check("with no repeated line to print", formatRepeatedLine(healthy), null);

    const line = formatScopeLine("/prs/[prId]", prDetail);
    assert(`the summary line carries the baseline: ${line}`, /13 ops, 7 tables, 6 repeats/.test(line));
    const repeatedLine = formatRepeatedLine(prDetail);
    assert(
        `the repeated line names where to look, with the kind mix: ${repeatedLine}`,
        /Purchase Requests ×6 \(find 5, list 1\)/.test(repeatedLine)
    );

    // A SIGNAL, NOT A VERDICT. A table over Airtable's 100-record page pages
    // legitimately, so repeated `list` on one table is not waste — the kind mix is
    // there so a reader can tell that from 1 + N, and the copy must not decide for
    // them. Same posture as #166's "facts, never verdicts".
    for (const word of ["waste", "wasteful", "too many", "inefficient", "should", "bad", "excessive"]) {
        assert(
            `no verdict word "${word}" in the summary or repeated line`,
            !line.toLowerCase().includes(word) && !repeatedLine.toLowerCase().includes(word)
        );
    }

    // ── the file log: path resolution ───────────────────────────────────────
    // Pure, and every branch pinned, because a path that silently resolves to
    // nothing is the same silence the whole module exists to avoid.
    check("unset means off", resolveOpsFile({}, "/repo"), null);
    check("empty means off", resolveOpsFile({ AIRTABLE_OPS_FILE: "  " }, "/repo"), null);
    check("0 means off", resolveOpsFile({ AIRTABLE_OPS_FILE: "0" }, "/repo"), null);
    check("false means off", resolveOpsFile({ AIRTABLE_OPS_FILE: "false" }, "/repo"), null);
    assert(
        `1 means the conventional path (${DEFAULT_OPS_FILE})`,
        resolveOpsFile({ AIRTABLE_OPS_FILE: "1" }, "/repo").endsWith(DEFAULT_OPS_FILE)
    );
    assert(
        "true means the same",
        resolveOpsFile({ AIRTABLE_OPS_FILE: "true" }, "/repo").endsWith(DEFAULT_OPS_FILE)
    );
    assert(
        "a relative path resolves against cwd",
        resolveOpsFile({ AIRTABLE_OPS_FILE: "logs/ops.jsonl" }, "/repo").includes("repo")
    );
    check(
        "an absolute path is taken as given",
        resolveOpsFile({ AIRTABLE_OPS_FILE: "/tmp/ops.jsonl" }, "/repo"),
        "/tmp/ops.jsonl"
    );
    // The conventional path must be gitignored, or a measurement log becomes a
    // committed file that grows on every run.
    const ignored = readFileSync(repoPath(".gitignore"), "utf8");
    assert(`${DEFAULT_OPS_FILE} is in .gitignore`, ignored.includes(DEFAULT_OPS_FILE));

    // ── the file log: which process wrote a line ────────────────────────────
    check("a script is named by its own file", processTag("/repo/scripts/tests/verify-overage-167.mjs", undefined), "verify-overage-167.mjs");
    check("a Windows path too", processTag("C:\\repo\\scripts\\tests\\verify-x.mjs", undefined), "verify-x.mjs");
    check("next is recognized by its package path", processTag("/repo/node_modules/next/dist/server/lib/start-server.js", undefined), "next");
    check("and by NEXT_RUNTIME", processTag("/whatever", "nodejs"), "next");
    check("an unknown entry point is node", processTag("", undefined), "node");

    // ── the file log: record shape ──────────────────────────────────────────
    // NOTHING IDENTIFYING. A record carries a label, table names, kinds and
    // counts. "We only write counts" is exactly the claim that decays when
    // someone adds a debugging field, so the key set is closed and checked.
    const scopeRecord = buildScopeRecord("/prs/[prId]", prDetail, "2026-08-06T00:00:00.000Z", { pid: 1, proc: "next" });
    const processRecord = buildProcessRecord({ total: 487, byLabel: { unlabeled: 487 } }, "2026-08-06T00:00:00.000Z", { pid: 2, proc: "verify-overage-167.mjs" });

    for (const [name, record] of [["scope", scopeRecord], ["process", processRecord]]) {
        const unexpected = Object.keys(record).filter((k) => !RECORD_KEYS.includes(k));
        check(`the ${name} record carries no key outside RECORD_KEYS`, unexpected.join(","), "");
        assert(`the ${name} record has a timestamp`, typeof record.t === "string" && record.t.includes("T"));
        assert(`the ${name} record names its process`, typeof record.proc === "string" && record.proc.length > 0);
        assert(`the ${name} record names its pid`, Number.isInteger(record.pid));
        // A record id is rec + 14 chars; a serialized record must never contain one.
        assert(`the ${name} record contains nothing that looks like a record id`, !/rec[A-Za-z0-9]{14}/.test(JSON.stringify(record)));
    }
    check("the scope record's ops match the summary", scopeRecord.ops, 13);
    check("and it keeps the per-table breakdown", scopeRecord.by["Purchase Requests"].find, 5);
    check("the process record carries per-label totals", processRecord.labels.unlabeled, 487);
    // A script opens no scope, so the process record is the ONLY place its
    // operations are recorded — hence per-label detail rather than a bare number.
    check("one line per record — no embedded newline", JSON.stringify(scopeRecord).includes("\n"), false);

    // ONE APPEND CALL, which is the whole concurrency mitigation: an O_APPEND
    // write cannot interleave with another process's, but a line split across two
    // write calls can be interleaved in the middle. Structural, because the
    // property is about how the code writes rather than about what it computes.
    const opsAst = parseFile("lib/airtableOps.js").ast;
    check("exactly one appendFileSync call in the module", callsTo(opsAst, "appendFileSync").length, 1);
    assert(
        "and the module never throws from the append path",
        (() => {
            const append = resolveFunction(opsAst, "appendRecord");
            if (!append) return false;
            let throws = false;
            walk(append, (n) => {
                if (n.type === "ThrowStatement") throws = true;
            });
            return !throws;
        })()
    );

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
