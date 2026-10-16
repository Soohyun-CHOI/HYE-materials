// Every run reaches the test base unless it names the live one (#534).
//
// THE RULE. `lib/airtableBase.js` decides which base a run reaches — the test base, from
// `AIRTABLE_TEST_API_KEY` and `AIRTABLE_TEST_BASE_ID`, unless `AIRTABLE_BASE=live` or the
// production deployment names the live one — and it holds the live base's id as the one place
// in this repository that id is written. Three things are held here, each of which would let a
// run reach the live base without naming it:
//
//   1. THE ANSWER, BY VALUE, over environments built in this file: the default, both ways of
//      naming the live base, and every refusal — a test base id that is the live one, a name
//      other than `live`, and the live base named with only the test key to hand, which must
//      fail rather than fall back.
//   2. NO OTHER FILE READS THE VARIABLES. A script that read `AIRTABLE_API_KEY` itself would
//      reach whatever that key reaches, past every refusal above. Every JavaScript file under
//      `app/`, `components/`, `lib/` and `scripts/`, and every file at the root, is parsed: a
//      `process.env` read of one of the five names, or the name as a whole string anywhere but
//      in the module, is a finding. Every Python file is read for an `os.environ`/`os.getenv`
//      read or a whole quoted name; the four scripts there ask through `airtable_base.py`,
//      which asks `node`.
//   3. THE LIVE ID IN ONE PLACE. No file in the repository but the module — code, notes, a
//      committed ledger — carries the id, so no copy can drift from it or be pasted into an
//      environment. The id is read from the module rather than written here, so this file is
//      not the second copy it looks for.
//
// THE FILE LIST IS GIT'S, TRACKED AND UNTRACKED-NOT-IGNORED (`ls-files --cached --others
// --exclude-standard`), so a file written and not yet committed is held the same as one that
// is — the module itself is that file on the branch that adds it — and `.env.local`, which
// does carry the id, is ignored and out of reach by construction. This tier's own directory is
// left out of 2, since its checks plant the names on purpose; it is not left out of 3.
//
// WHAT IT CANNOT SEE. A name built at runtime — `process.env["AIRTABLE_" + kind]` — is no
// whole string and no member read, and nothing in the tree does that. Whether Vercel's scopes
// hold the right variables is the dashboard's, not the tree's.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, calleeName, parseSource, walk } from "./_ast.mjs";
import { LIVE_BASE_ID, describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every run reaches the test base unless it names the live one (#534)";

const MODULE = "lib/airtableBase.js";
const PY_HELPER = "scripts/import/airtable_base.py";

/** The variables only the module reads. */
const BASE_VARIABLES = ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_TEST_API_KEY", "AIRTABLE_TEST_BASE_ID", "AIRTABLE_BASE"];

/** The files the repository has or is about to have, as git lists them. */
function repositoryFiles() {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 1 << 26,
    });
    return [...new Set(out.split("\0").filter(Boolean))].sort();
}

/** Every read of a base variable in a parsed JavaScript source, as `NAME at offset`. */
export function jsVariableReads(ast) {
    const findings = [];
    walk(ast, (node) => {
        if (node.type === "Literal" && BASE_VARIABLES.includes(node.value)) findings.push(`${node.value} at ${node.start}`);
        if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
            const text = node.quasis[0]?.value?.cooked;
            if (BASE_VARIABLES.includes(text)) findings.push(`${text} at ${node.start}`);
        }
        if (
            node.type === "MemberExpression" &&
            !node.computed &&
            BASE_VARIABLES.includes(node.property?.name) &&
            node.object?.type === "MemberExpression" &&
            node.object.object?.name === "process" &&
            node.object.property?.name === "env"
        ) {
            findings.push(`${node.property.name} at ${node.start}`);
        }
    });
    return findings;
}

/** Every read or whole quoted name of a base variable in a Python source, as `NAME on line N`. */
export function pyVariableReads(source) {
    const findings = [];
    source.split(/\r?\n/).forEach((line, i) => {
        for (const name of BASE_VARIABLES) {
            if (new RegExp(`["']${name}["']`).test(line)) findings.push(`${name} on line ${i + 1}`);
        }
    });
    return findings;
}

/** How many times a text carries the live base's id. */
export function liveIdCount(text) {
    return text.split(LIVE_BASE_ID).length - 1;
}

const isJs = (path) => /\.(m?js|jsx)$/.test(path);
const inJsScope = (path) =>
    isJs(path) &&
    !path.startsWith("scripts/tests/offline/") &&
    (/^(app|components|lib|scripts)\//.test(path) || !path.includes("/"));

export function run({ check, assert, log }) {
    // ── 1. the answer, by value ──────────────────────────────────────────────
    log("resolveAirtableBase, by value:");
    const TEST = { AIRTABLE_TEST_API_KEY: "patTest", AIRTABLE_TEST_BASE_ID: "appTestBase00000" };
    const LIVE_KEY = { AIRTABLE_API_KEY: "patLive" };
    const answer = (env) => {
        try {
            const { baseId, apiKey, apiKeyVariable, live, namedBy } = resolveAirtableBase(env);
            return `${live ? "LIVE" : "test"} ${baseId === LIVE_BASE_ID ? "LIVE_BASE_ID" : baseId} ${apiKey} ${apiKeyVariable} ${namedBy}`;
        } catch (error) {
            return `refused: ${error.message}`;
        }
    };
    check("  the test pair reaches the test base", answer(TEST), "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null");
    check("  with the live key beside it, still the test base", answer({ ...TEST, ...LIVE_KEY }), "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null");
    check(
        "  an old AIRTABLE_BASE_ID is read by nothing",
        answer({ ...TEST, ...LIVE_KEY, AIRTABLE_BASE_ID: LIVE_BASE_ID }),
        "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null"
    );
    check(
        "  AIRTABLE_BASE=live names the live base",
        answer({ ...TEST, ...LIVE_KEY, AIRTABLE_BASE: "live" }),
        "LIVE LIVE_BASE_ID patLive AIRTABLE_API_KEY AIRTABLE_BASE=live"
    );
    check(
        "  the production deployment names it",
        answer({ ...LIVE_KEY, VERCEL_ENV: "production" }),
        "LIVE LIVE_BASE_ID patLive AIRTABLE_API_KEY VERCEL_ENV=production"
    );
    check("  a preview deployment does not", answer({ ...TEST, ...LIVE_KEY, VERCEL_ENV: "preview" }), "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null");
    check("  values are read trimmed", answer({ AIRTABLE_TEST_API_KEY: " patTest ", AIRTABLE_TEST_BASE_ID: "appTestBase00000\n" }), "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null");
    check("  no environment is refused, naming the test key", answer({}), "refused: Missing AIRTABLE_TEST_API_KEY in environment variables — the test base's key");
    check("  the test key alone is refused, naming the id", answer({ AIRTABLE_TEST_API_KEY: "patTest" }), "refused: Missing AIRTABLE_TEST_BASE_ID in environment variables");
    check(
        "  a test base id that is the live one is refused",
        answer({ AIRTABLE_TEST_API_KEY: "patTest", AIRTABLE_TEST_BASE_ID: LIVE_BASE_ID }),
        "refused: AIRTABLE_TEST_BASE_ID names the live base — a run reaches it only by naming it, with AIRTABLE_BASE=live"
    );
    check(
        "  the live base named with only the test pair is refused, not the test base",
        answer({ ...TEST, AIRTABLE_BASE: "live" }),
        "refused: Missing AIRTABLE_API_KEY in environment variables — the live base's key"
    );
    check(
        "  production with only the test pair is refused, not the test base",
        answer({ ...TEST, VERCEL_ENV: "production" }),
        "refused: Missing AIRTABLE_API_KEY in environment variables — the live base's key"
    );
    for (const name of ["Live", "LIVE", "prod", "production", "test"]) {
        check(
            `  AIRTABLE_BASE=${name} is refused`,
            answer({ ...TEST, ...LIVE_KEY, AIRTABLE_BASE: name }),
            `refused: AIRTABLE_BASE is "${name}", and the one value it takes is "live" — leave it unset to reach the test base`
        );
    }
    check("  an empty AIRTABLE_BASE is unset", answer({ ...TEST, AIRTABLE_BASE: "" }), "test appTestBase00000 patTest AIRTABLE_TEST_API_KEY null");
    check("  the live id is an Airtable base id", /^app[A-Za-z0-9]{14}$/.test(LIVE_BASE_ID), true);
    check("  the test base described", describeAirtableBase(resolveAirtableBase(TEST)), "test base appTestBase00000");
    check(
        "  the live base described, with how it was named",
        describeAirtableBase(resolveAirtableBase({ ...LIVE_KEY, AIRTABLE_BASE: "live" })),
        `LIVE base ${LIVE_BASE_ID} (named by AIRTABLE_BASE=live)`
    );

    // ── the client and the Python helper take the module's answer ────────────
    log("");
    log("the client and the Python scripts take the module's answer:");
    const clientAst = parseSource(readFileSync(join(REPO_ROOT, "lib/airtable/client.js"), "utf8"), "client.js").ast;
    let resolvedInto = null;
    let baseArgument = null;
    walk(clientAst, (node) => {
        if (node.type === "VariableDeclarator" && calleeName(node.init ?? {}) === "resolveAirtableBase") resolvedInto = node.id?.name ?? null;
        if (
            node.type === "CallExpression" &&
            node.callee?.type === "MemberExpression" &&
            node.callee.object?.name === "Airtable" &&
            node.callee.property?.name === "base"
        ) {
            const arg = node.arguments[0];
            baseArgument = arg?.type === "MemberExpression" ? `${arg.object?.name}.${arg.property?.name}` : arg?.type ?? null;
        }
    });
    assert("  client.js binds resolveAirtableBase's answer", resolvedInto !== null);
    check("  and hands its baseId to Airtable.base", baseArgument, `${resolvedInto}.baseId`);
    const helper = readFileSync(join(REPO_ROOT, PY_HELPER), "utf8");
    assert("  airtable_base.py asks lib/airtableBase.js", helper.includes("from './lib/airtableBase.js'") && helper.includes("resolveAirtableBase(process.env)"));
    assert("  and hands back the key's name, never the key", helper.includes("apiKeyVariable: base.apiKeyVariable") && !/apiKey: base\.apiKey\b/.test(helper));

    // ── 2. no other file reads the variables ─────────────────────────────────
    log("");
    log("no file but the module reads the base variables:");
    const files = repositoryFiles();
    log(`  ${files.length} files listed`);
    assert("  the listing is a whole tree", files.length > 300);
    for (const expected of [MODULE, "lib/airtable/client.js", "scripts/protectedTables.mjs", PY_HELPER, "proxy.js"]) {
        assert(`  the listing holds ${expected}`, files.includes(expected));
    }
    const jsFiles = files.filter(inJsScope);
    const pyFiles = files.filter((path) => path.endsWith(".py"));
    log(`  ${jsFiles.length} JavaScript and ${pyFiles.length} Python files read`);
    assert("  more than two hundred JavaScript files were read", jsFiles.length > 200);
    assert("  the four Python scripts and the helper were read", pyFiles.length >= 5);
    const jsReads = {};
    for (const path of jsFiles) {
        const found = jsVariableReads(parseSource(readFileSync(join(REPO_ROOT, path), "utf8"), path).ast);
        if (found.length > 0) jsReads[path] = found;
    }
    assert("  the module itself is seen to read them", (jsReads[MODULE] ?? []).length >= 4);
    check(
        "  no other JavaScript file does",
        Object.entries(jsReads)
            .filter(([path]) => path !== MODULE)
            .map(([path, found]) => `${path}: ${found.join(", ")}`)
            .join("; "),
        ""
    );
    const pyReads = pyFiles
        .map((path) => [path, pyVariableReads(readFileSync(join(REPO_ROOT, path), "utf8"))])
        .filter(([, found]) => found.length > 0);
    check("  no Python file does", pyReads.map(([path, found]) => `${path}: ${found.join(", ")}`).join("; "), "");
    const pyClients = pyFiles.filter((path) => path !== PY_HELPER && readFileSync(join(REPO_ROOT, path), "utf8").includes("api.airtable.com"));
    assert("  four Python scripts reach Airtable", pyClients.length === 4);
    // The import as its own line and the call that binds the answer, so an alias or an import
    // nothing calls is a finding rather than a substring that happens to match.
    const asksHelper = (source) =>
        /^from airtable_base import resolve_airtable_base\r?$/m.test(source) && /^AIRTABLE_BASE_ID, AIRTABLE_API_KEY, \w+ = resolve_airtable_base\(\)\r?$/m.test(source);
    check("  and each asks the helper", pyClients.filter((path) => !asksHelper(readFileSync(join(REPO_ROOT, path), "utf8"))).join(", "), "");

    // ── 3. the live id in one place ──────────────────────────────────────────
    log("");
    log("the live base's id is written in one file:");
    const carriers = files
        .map((path) => {
            let text;
            try {
                text = readFileSync(join(REPO_ROOT, path), "utf8");
            } catch {
                return null;
            }
            return [path, liveIdCount(text)];
        })
        .filter((entry) => entry && entry[1] > 0);
    check("  the module carries it once", Object.fromEntries(carriers)[MODULE], 1);
    check("  no other file does", carriers.filter(([path]) => path !== MODULE).map(([path]) => path).join(", "), "");

    // ── the readers see what they are for ────────────────────────────────────
    log("");
    log("anti-vacuity — each reader on planted sources:");
    const planted = (source) => parseSource(source, "planted").ast;
    check("  process.env.AIRTABLE_API_KEY is found", jsVariableReads(planted("const k = process.env.AIRTABLE_API_KEY;")).length, 1);
    check("  process.env.AIRTABLE_BASE_ID is found", jsVariableReads(planted("fetch(`/v0/${process.env.AIRTABLE_BASE_ID}`);")).length, 1);
    check('  process.env["AIRTABLE_TEST_BASE_ID"] is found', jsVariableReads(planted('const b = process.env["AIRTABLE_TEST_BASE_ID"];')).length, 1);
    check('  read(env, "AIRTABLE_BASE") is found', jsVariableReads(planted('const n = read(env, "AIRTABLE_BASE");')).length, 1);
    check("  a whole name in a template is found", jsVariableReads(planted("const n = `AIRTABLE_TEST_API_KEY`;")).length, 1);
    check("  AIRTABLE_OPS_LOG is not one of them", jsVariableReads(planted("const l = process.env.AIRTABLE_OPS_LOG;")).length, 0);
    check("  a sentence naming one is not a read", jsVariableReads(planted('log("set AIRTABLE_API_KEY first");')).length, 0);
    check("  a comment naming one is not a read", jsVariableReads(planted("// process.env.AIRTABLE_API_KEY\nconst x = 1;")).length, 0);
    check('  os.environ["AIRTABLE_API_KEY"] is found', pyVariableReads('KEY = os.environ["AIRTABLE_API_KEY"]').length, 1);
    check("  os.getenv('AIRTABLE_BASE') is found", pyVariableReads("NAME = os.getenv('AIRTABLE_BASE')").length, 1);
    check("  a key read by its returned name is not", pyVariableReads('key = os.environ[answer["apiKeyVariable"]]').length, 0);
    check("  a Python sentence naming one is not", pyVariableReads("# AIRTABLE_BASE=live names the live base").length, 0);
    const asking = "from airtable_base import resolve_airtable_base\nAIRTABLE_BASE_ID, AIRTABLE_API_KEY, AIRTABLE_BASE = resolve_airtable_base()\n";
    check("  a Python script asking the helper passes", asksHelper(asking), true);
    check("  an aliased import is found", asksHelper(asking.replace("resolve_airtable_base\n", "resolve_airtable_base as ask\n")), false);
    check("  an import nothing calls is found", asksHelper(asking.split("\n")[0]), false);
    check("  the id is counted where it stands", liveIdCount(`const a = "${LIVE_BASE_ID}"; // ${LIVE_BASE_ID}`), 2);
    check("  and not where it does not", liveIdCount("appTestBase00000"), 0);
}

if (isMain(import.meta.url)) standalone(title, run);
