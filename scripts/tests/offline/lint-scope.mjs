// What the lint actually sees under scripts/ (#426).
//
// `no-undef` is enabled for scripts/ and reports nothing. That sentence is worth
// exactly as much as the globals it was asked against, and flat config MERGES
// `languageOptions.globals` rather than replacing them — so a section that sets
// Node's globals for scripts/ leaves every browser global from
// eslint-config-next still defined, and the rule goes on reporting 0 while being
// blind to 195 of the names it is supposed to watch. `eslint.config.mjs` turns
// the inherited names off one by one to get past that, deriving the off-list
// from the base config rather than typing it out.
//
// THE DERIVATION IS WHAT THIS CHECK IS HERE FOR. It has one failure mode and the
// failure is silent: an upstream change of shape returns no globals, the
// off-list is empty, the narrowing evaporates, and `no-undef` still reports 0 and
// still looks like coverage. `eslint.config.mjs` throws when it can derive
// nothing, which catches that one case at the point of the defect — but a throw
// can only see what the config file computed, never what ESLint resolved from it,
// because the merge happens afterwards. A section re-widened by a later config
// object, a rule turned back off, a glob that stops reaching a file: none of them
// reach that throw. So this asks the RESOLVED config, per file, which is the only
// place the question can be answered.
//
// IT ASKS PER FILE RATHER THAN PINNING THE GLOB, so the pattern in
// `eslint.config.mjs` cannot drift from the tree. A JS file under scripts/ that
// the pattern fails to reach fails here instead of quietly opting out.
//
// WHAT IT COSTS, MEASURED: `npm test` goes from about 10.3s to about 13.3s, and
// effectively all of that is the FIRST `calculateConfigForFile` call, which loads
// and normalizes the whole config array. The other ~160 files cost 9ms between
// them. So the price is loading eslint at all, not the per-file question — which
// is why the per-file question is asked rather than sampled.
//
// THE TIER BOUNDARY IS UNTOUCHED: eslint and globals are devDependencies on the
// same footing as acorn and jsqr — installed by `npm ci`, reaching no
// credentials, no network and no Airtable. Nothing here lints anything; it only
// asks what the configuration resolves to.

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ESLint } from "eslint";
import { REPO_ROOT, repoPath, toPosix } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Lint scope — no-undef under scripts/ and the globals it is asked against";

/** Extensions eslint lints. A file here with any other one is not its business. */
const JS_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];

/**
 * Every JS file under scripts/. A local three-line walk rather than `_ast.mjs`'s
 * `listJsFiles`, which collects `.js` alone and would miss the extension this
 * directory actually uses — the same reason `run-provenance.mjs` and
 * `fixture-cleanup.mjs` each keep their own.
 */
function listScriptFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) listScriptFiles(full, out);
        else if (JS_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
    return out;
}

/** The severity `no-undef` carries in a resolved config, as a number. */
function severityOf(rules, name) {
    const entry = rules?.[name];
    if (entry === undefined) return 0;
    const level = Array.isArray(entry) ? entry[0] : entry;
    return { off: 0, warn: 1, error: 2 }[level] ?? Number(level) ?? 0;
}

/** Is this global name live — defined at all — in a resolved config? */
function isLive(globalsMap, name) {
    return name in globalsMap && globalsMap[name] !== "off";
}

/**
 * Browser names that will never be Node globals, so an assertion about them does
 * not move when the `globals` package tracks a new Node release. `localStorage`
 * is deliberately NOT here: globals 16.5.0 added it to `nodeBuiltin` for Node's
 * own web storage, and a check naming it would have failed on a dependency bump
 * rather than on a defect.
 */
const BROWSER_ONLY = ["window", "document", "alert", "confirm", "XMLHttpRequest", "HTMLElement"];

/** CommonJS wrapper names. An .mjs cannot use them, so off is what makes `require()` here a failure. */
const COMMONJS_ONLY = ["require", "__dirname", "module", "exports"];

/** Node globals the scripts actually run on. Off would be an overshoot, and noisy. */
const NODE_NEEDED = ["process", "console", "fetch", "Buffer", "URL", "setTimeout"];

/**
 * Three files, one per execution context, named by hand. The enumeration above is
 * the only path to "the JS files under scripts/", so a floor on its length says
 * nothing about WHERE it looked — an enumeration that lost a whole directory
 * still returns plenty. #224's rule: a second path to the same answer has to be a
 * second path.
 */
const NAMED_BY_HAND = [
    "scripts/tests/offline/run-all.mjs", // the offline tier — plain node
    "scripts/tests/verify-authz.mjs", // the credentialed tier — .env.local and network
    "scripts/demo/seed_demo_fixtures.mjs", // the demo seeds — a third context again
];

export async function run({ check, assert, log }) {
    const eslint = new ESLint({ cwd: REPO_ROOT });

    const onDisk = listScriptFiles(repoPath("scripts"));
    const files = [];
    for (const file of onDisk) {
        if (await eslint.isPathIgnored(file)) continue;
        files.push(file);
    }
    const relPaths = new Set(files.map((f) => toPosix(relative(REPO_ROOT, f))));

    log(`scripts/ holds ${files.length} JS file(s) eslint would lint`);

    // --- the rule is on, for every one of them ---------------------------
    log("");
    log("no-undef is an error for every JS file under scripts/:");
    // Resolved per file rather than sampled from one of them. A section that
    // stops reaching PART of the tree is the realistic drift — a narrowed glob,
    // a new subdirectory — and one sample answers for whichever file it happened
    // to be.
    const offenders = [];
    const scriptsGlobals = new Map();
    for (const file of files) {
        const cfg = await eslint.calculateConfigForFile(file);
        const rel = toPosix(relative(REPO_ROOT, file));
        if (severityOf(cfg.rules, "no-undef") !== 2) offenders.push(rel);
        scriptsGlobals.set(rel, cfg.languageOptions?.globals ?? {});
    }
    check(
        "every file resolves no-undef to error",
        offenders.length === 0 ? "all" : `${offenders.length} do not: ${offenders.slice(0, 5).join(", ")}`,
        "all"
    );

    // --- the globals it is asked against ---------------------------------
    log("");
    log("and the globals that rule is asked against are Node's alone, in every file:");
    /** The files whose resolved config disagrees with `want` about `name`. */
    const disagreeing = (name, want) =>
        [...scriptsGlobals].filter(([, g]) => isLive(g, name) !== want).map(([rel]) => rel);
    for (const name of [...BROWSER_ONLY, ...COMMONJS_ONLY]) {
        const bad = disagreeing(name, false);
        check(`  ${name} is not defined`, bad.length === 0 ? "in none" : `in ${bad.length}: ${bad[0]}`, "in none");
    }
    for (const name of NODE_NEEDED) {
        const bad = disagreeing(name, true);
        check(`  ${name} IS defined`, bad.length === 0 ? "in all" : `missing in ${bad.length}: ${bad[0]}`, "in all");
    }
    // The first file the walk resolved, not a file named here: keying this off a
    // hard-coded path would hand back `{}` the day that file is renamed, and an
    // empty globals map passes "window is not defined" for the wrong reason. The
    // per-file block above is what establishes that every map in it is populated
    // — `process` and `console` are live `in all`, which an empty one is not.
    const sampleGlobals = scriptsGlobals.values().next().value ?? {};

    // --- how much the narrowing actually removed --------------------------
    //
    // Two independently resolved configs compared against each other, rather
    // than one config compared against an expression over itself — which is the
    // shape #351 measured passing its own mutation. A floor rather than the
    // measured 1,110, because the inherited set grows with the browser.
    // `calculateConfigForFile` resolves by PATTERN and never opens the file, so
    // this anchor is a path under app/ rather than a dependency on that file
    // continuing to exist.
    const appConfig = await eslint.calculateConfigForFile(repoPath("app/page.js"));
    const appGlobals = appConfig.languageOptions?.globals ?? {};
    const liveForApp = Object.keys(appGlobals).filter((n) => isLive(appGlobals, n));
    const liveForScripts = Object.keys(sampleGlobals).filter((n) => isLive(sampleGlobals, n));
    const turnedOff = liveForApp.filter((n) => !isLive(sampleGlobals, n));
    log("");
    log(`an app/ file sees ${liveForApp.length} globals; a scripts/ file sees ${liveForScripts.length}`);
    assert(`the narrowing turns off at least 1000 of them (${turnedOff.length})`, turnedOff.length >= 1000);

    // --- anti-vacuity — this check is seen to be able to fail -------------
    log("");
    log("anti-vacuity — the same questions, asked of a file outside scripts/:");
    // Every assertion above is of the form "this name is off". "Off" and "the
    // oracle always says off" are the same answer, so the oracle is put on a file
    // where the expected answer is the opposite one, through the same code path.
    // Deliberately NOT asserting that no-undef is off for app/ — that would read
    // as a rule against ever enabling it there, which is a live question this
    // issue left open rather than settled.
    assert("window resolves LIVE for an app/ file", isLive(appGlobals, "window"));
    assert("  and document does too", isLive(appGlobals, "document"));
    assert("  so 'off' is a verdict this check can tell from 'defined'", !isLive(sampleGlobals, "window"));
    log(`  (for the record, app/ resolves no-undef to severity ${severityOf(appConfig.rules, "no-undef")})`);

    // The enumeration's reach, not just its size: a walk that lost a directory
    // still returns plenty of files and passes a floor.
    assert(`the walk found files (${files.length})`, files.length >= 100);
    for (const named of NAMED_BY_HAND) {
        assert(`  and reached ${named}`, relPaths.has(named));
    }
}

if (isMain(import.meta.url)) await standalone(title, run);
