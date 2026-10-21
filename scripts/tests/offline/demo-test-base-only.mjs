// Every demo script reaches the test base alone (#537).
//
// THE RULE. The live base holds the site's records alone since #537, and the demo is the test
// base's. Every script in `scripts/demo/` that seeds the demo, empties it or rebuilds it asks
// `scripts/demo/_testBaseOnly.mjs:refusesLiveBase` as its first statement and stops on true. This
// holds the module's answer by value, over environments built here, and every script to asking.
//
// WHAT "FIRST" MEANS. The first top-level statement that is not an import is an `if` whose test is
// the call itself — not negated, not joined — naming the script by its own file name, and whose
// consequent is `process.exit` with a code other than 0. The imports run before it: a module's
// imports are evaluated before its body, and none of the modules these scripts import reaches the
// base as it loads. One that did would reach it before the guard, which this cannot see.
//
// FOUND, NOT LISTED. Every `.mjs` in the directory is read. A script that does not ask is named in
// `EXEMPT` with why, or is a finding; an exemption naming a file that is gone is a finding too. A
// helper — a file beginning `_` — asks nothing itself, and every script in the directory importing
// one must ask.
//
// WHAT IT CANNOT SEE. Whether an exempt script writes nothing the demo is made of is its reason,
// read by a person. Whether the guard refuses a real run is the run's own: on 2026-10-21 each of
// the twelve was started on the test base with the guard alone told the live base — a temporary
// edit, restored byte for byte — and the network trapped, and each printed its refusal, exited 1
// and sent nothing. A writing script is never pointed at the live base to show it refuses.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT, parseSource, walk } from "./_ast.mjs";
import { refusesLiveBase } from "../../demo/_testBaseOnly.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every demo script reaches the test base alone (#537)";

const DIR = "scripts/demo";
const GUARD = "refusesLiveBase";
const GUARD_SPECIFIER = "./_testBaseOnly.mjs";

/** The scripts here that do not ask, each with why. */
const EXEMPT = {
    "mint_session.mjs": "makes one sign-in row for a browser walk, the way in on either base (verification.md)",
    "make-invoice-pdf.mjs": "reads an order and writes a PDF to disk; it writes nothing to a base",
};

/** A test base, a live key and an id shaped as Airtable's — none of them a credential. */
const TEST_ENV = { AIRTABLE_TEST_API_KEY: "patTestKey", AIRTABLE_TEST_BASE_ID: "appTestBase00000" };
const LIVE_KEY = { AIRTABLE_API_KEY: "patLiveKey" };

/** What is wrong with a script's first statement, as a list; empty when it asks first. */
export function guardFindings(source, script) {
    const { ast } = parseSource(source, script);
    const findings = [];
    let imported = false;
    walk(ast, (node) => {
        if (node.type === "ImportDeclaration" && node.source.value === GUARD_SPECIFIER && node.specifiers.some((s) => s.imported?.name === GUARD)) imported = true;
    });
    if (!imported) findings.push(`imports no ${GUARD} from ${GUARD_SPECIFIER}`);
    const first = ast.body.find((node) => node.type !== "ImportDeclaration");
    if (first?.type !== "IfStatement") return [...findings, "its first statement is no if"];
    const test = first.test;
    if (test.type !== "CallExpression" || test.callee?.name !== GUARD) return [...findings, `its first statement's test is not a call to ${GUARD}`];
    const named = test.arguments[0]?.properties?.find((p) => p.key?.name === "script")?.value;
    if (named?.type !== "Literal" || named.value !== script) findings.push(`it names itself ${JSON.stringify(named?.value ?? null)}, not ${JSON.stringify(script)}`);
    const exit = first.consequent.type === "BlockStatement" ? first.consequent.body[0] : first.consequent;
    const call = exit?.type === "ExpressionStatement" ? exit.expression : null;
    const exits = call?.type === "CallExpression" && call.callee?.object?.name === "process" && call.callee?.property?.name === "exit";
    const code = call?.arguments?.[0];
    if (!exits) findings.push("a refusal does not exit");
    else if (code?.type !== "Literal" || typeof code.value !== "number" || code.value === 0) findings.push("a refusal exits with no code other than 0");
    return findings;
}

/** The local files a source imports, by specifier. */
function localImports(source, label) {
    const out = [];
    walk(parseSource(source, label).ast, (node) => {
        if (node.type === "ImportDeclaration" && typeof node.source.value === "string" && node.source.value.startsWith("./")) out.push(node.source.value.slice(2));
    });
    return out;
}

export function run({ check, assert, log }) {
    // ── the answer, by value ────────────────────────────────────────────────
    log("the guard's answer:");
    const ask = (env) => {
        const said = [];
        const refused = refusesLiveBase({ script: "planted", env, log: (line) => said.push(line) });
        return { refused, said };
    };
    const test = ask(TEST_ENV);
    check("  the test base goes through", test.refused, false);
    check("  and says nothing", test.said.length, 0);
    const named = ask({ ...TEST_ENV, ...LIVE_KEY, AIRTABLE_BASE: "live" });
    check("  the live base named by AIRTABLE_BASE is refused", named.refused, true);
    assert("  and the refusal names the script and #537", named.said.length === 1 && named.said[0].includes("planted") && named.said[0].includes("#537"));
    check("  the production deployment is refused", ask({ ...TEST_ENV, ...LIVE_KEY, VERCEL_ENV: "production" }).refused, true);
    check("  an environment naming no base is refused", ask({}).refused, true);
    check("  the live base named without its key is refused", ask({ ...TEST_ENV, AIRTABLE_BASE: "live" }).refused, true);
    check("  a name the module does not take is refused", ask({ ...TEST_ENV, AIRTABLE_BASE: "prod" }).refused, true);

    // ── every script asks first ─────────────────────────────────────────────
    log("");
    log("every script in scripts/demo asks first:");
    const files = readdirSync(join(REPO_ROOT, DIR)).filter((name) => name.endsWith(".mjs")).sort();
    const sources = Object.fromEntries(files.map((name) => [name, readFileSync(join(REPO_ROOT, DIR, name), "utf8")]));
    const helpers = files.filter((name) => name.startsWith("_"));
    const scripts = files.filter((name) => !name.startsWith("_"));
    const asking = scripts.filter((name) => !(name in EXEMPT));
    log(`  ${files.length} files: ${scripts.length} scripts, ${helpers.length} helpers, ${Object.keys(EXEMPT).length} exempt`);
    for (const name of asking) {
        const findings = guardFindings(sources[name], name.replace(/\.mjs$/, ""));
        check(`  ${name}`, findings.join("; "), "");
    }
    for (const [name, why] of Object.entries(EXEMPT)) {
        assert(`  ${name} is exempt, and is there — ${why}`, files.includes(name));
        check(`  and asks nothing, so the exemption is not stale`, guardFindings(sources[name] ?? "", name.replace(/\.mjs$/, "")).length > 0, true);
    }
    for (const helper of helpers) {
        const importers = files.filter((name) => localImports(sources[name], name).includes(helper));
        const unguarded = importers.filter((name) => !name.startsWith("_") && guardFindings(sources[name], name.replace(/\.mjs$/, "")).length > 0);
        check(`  every script importing ${helper} asks`, unguarded.join(", "), "");
    }

    // ── anti-vacuity: the walk reached them, and the reader sees each defect ──
    log("");
    log("anti-vacuity:");
    assert("  twelve scripts or more ask", asking.length >= 12);
    for (const name of ["wipe_base.mjs", "reset_demo.mjs", "seed_full_demo.mjs", "seed_demo_fixtures.mjs"]) assert(`  ${name} is among them`, asking.includes(name));
    assert("  the guard module is a helper here", helpers.includes("_testBaseOnly.mjs"));
    const head = 'import { base } from "../../lib/airtable/client.js";\nimport { refusesLiveBase } from "./_testBaseOnly.mjs";\n';
    const good = `${head}\nif (refusesLiveBase({ script: "seed_x" })) process.exit(1);\nconst CONFIRM = true;\n`;
    check("  a script asking first passes", guardFindings(good, "seed_x").length, 0);
    check("  so does one exiting inside a block", guardFindings(`${head}if (refusesLiveBase({ script: "seed_x" })) {\n    process.exit(1);\n}\n`, "seed_x").length, 0);
    const found = (source) => guardFindings(source, "seed_x").length > 0;
    check("  a statement before the guard is found", found(`${head}const CONFIRM = true;\nif (refusesLiveBase({ script: "seed_x" })) process.exit(1);\n`), true);
    check("  another script's name is found", found(good.replace('"seed_x"', '"seed_y"')), true);
    check("  a negated test is found", found(good.replace("if (refusesLiveBase", "if (!refusesLiveBase")), true);
    check("  a joined test is found", found(good.replace('"seed_x" }))', '"seed_x" }) && false)')), true);
    check("  a refusal that only logs is found", found(good.replace("process.exit(1)", "console.log(1)")), true);
    check("  a refusal exiting 0 is found", found(good.replace("process.exit(1)", "process.exit(0)")), true);
    check("  a guard not imported is found", found(good.replace('import { refusesLiveBase } from "./_testBaseOnly.mjs";\n', "")), true);
    check("  a script with no guard at all is found", found(`${head}const CONFIRM = true;\n`), true);
}

if (isMain(import.meta.url)) standalone(title, run);
