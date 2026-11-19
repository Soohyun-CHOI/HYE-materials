// The test deployment is a preview of main and never production (#681).
//
// THE RULE. `test.hyeusa.com` serves the latest deployment of one branch,
// `lib/deployment.js:TEST_DEPLOYMENT_BRANCH`, which `.github/workflows/test-deployment.yml` keeps
// one commit past main and holding main's tree. Built as a preview, it reaches the test base with
// the materials screens open. Three things are held here, each of which would let it be built as
// something else, or let the guard against that break the deployments around it:
//
//   1. THE REFUSAL, BY VALUE. `assertTestBranchNotProduction` throws on a production build of
//      that branch, the branch read trimmed as `VERCEL_ENV` is, and on nothing else: main's
//      production build, a production build naming no branch, the branch's own preview, a local
//      run and a neighbor's name all go on. `isPreviewDeployment` holds a preview and nothing
//      else, which is what `resolveAirtableBase` refuses the live base on
//      (`offline/airtable-base.mjs`).
//   2. AT BUILD, END TO END, AND AT NO REQUEST. `next.config.mjs` is evaluated in a child process
//      handed one environment and nothing else of this one's, as a build evaluates it: the
//      refused build exits non-zero naming the refusal; main's production build, the test
//      deployment's own preview and a local run load, the preview opening the materials screens.
//      The modules a request runs — the base, the mail, the switch — answer the refused
//      environment without throwing, and the refusal has one call in the app, a statement at
//      the top of `next.config.mjs` before anything else it does and inside no function, so no
//      request reaches it.
//   3. THE WORKFLOW, READ AS TEXT. The branch it writes and the push it runs on name
//      `TEST_DEPLOYMENT_BRANCH` and no other branch but main; it holds `contents: write` and no
//      other permission or secret; it checks main out afresh; and the commit it writes is main's
//      tree under main's head, its message naming main's short SHA.
//
// WHAT IT CANNOT SEE. The workflow runs on GitHub alone, so this reads its text and does not run
// it — its step was run against a local remote in the pull request. Whether Vercel builds that
// branch as a preview, serves it at the address and keeps the live key out of the Preview scope
// is the dashboard's, which `docs/notes/airtable-access.md` lists. Whether Vercel evaluates
// `next.config.mjs` at a request is its runtime's; a deployment this refuses is never built, so
// there is none to evaluate.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
    TEST_DEPLOYMENT_BRANCH,
    assertTestBranchNotProduction,
    isPreviewDeployment,
    isProductionDeployment,
} from "../../../lib/deployment.js";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";
import { routeMail } from "../../../lib/mailRedirect.js";
import { materialsScreensAtBuild } from "../../../lib/openScreens.js";
import { REPO_ROOT, callsTo, isFunctionNode, listJsFiles, parentMap, parseFile, repoPath, toPosix } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The test deployment is a preview of main and never production (#681)";

const WORKFLOW = ".github/workflows/test-deployment.yml";
const CONFIG = "next.config.mjs";
const DEPLOYMENT = "lib/deployment.js";
const REFUSAL = "assertTestBranchNotProduction";

/** The branch, by value: the issue names it, and the workflow and Vercel's domain spell it. */
const BRANCH = "test-deployment";

/** The build the refusal stops. */
const REFUSED = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: BRANCH };

/** Builds, and whether the refusal stops each — typed out, since the issue decides every one. */
const BUILDS = [
    ["a production build of the test deployment's branch", REFUSED, true],
    ["the same, padded", { VERCEL_ENV: " production\n", VERCEL_GIT_COMMIT_REF: ` ${BRANCH}\n` }, true],
    ["main's production build", { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }, false],
    ["a production build naming no branch", { VERCEL_ENV: "production" }, false],
    ["the test deployment's own preview", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: BRANCH }, false],
    ["a local run, naming neither", {}, false],
    ["a development run of the branch", { VERCEL_ENV: "development", VERCEL_GIT_COMMIT_REF: BRANCH }, false],
    ["a production build of a neighbor's name", { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: `${BRANCH}-2` }, false],
    ["a production build of the name in another case", { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: BRANCH.toUpperCase() }, false],
];

/** The start of the refusal's words, which a failed build prints. */
const REFUSAL_WORDS = `A production build of "${BRANCH}", the test deployment's branch, is refused (#681)`;

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const urlOf = (rel) => JSON.stringify(pathToFileURL(repoPath(rel)).href);

/** What a child process is handed besides its case: enough to start, and no `VERCEL_*`. */
const CHILD_BASE = Object.fromEntries(
    ["PATH", "SystemRoot"].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]])
);

/** The config as a build with this environment evaluates it: the answer it hands the app. */
const CONFIG_SCRIPT = `
const { default: config } = await import(${urlOf(CONFIG)});
process.stdout.write(JSON.stringify(config.env ?? null));
`;

const execFileAsync = promisify(execFile);

/** Evaluates the config in a child holding `env` alone: whether it loaded, its answer, what it printed. */
async function evaluateConfig(env) {
    try {
        const { stdout } = await execFileAsync(process.execPath, ["--no-warnings", "--input-type=module", "-e", CONFIG_SCRIPT], {
            cwd: REPO_ROOT,
            env: { ...CHILD_BASE, ...env },
            encoding: "utf8",
            windowsHide: true,
        });
        return { loaded: true, answer: JSON.parse(stdout), printed: "" };
    } catch (error) {
        return { loaded: false, answer: null, printed: String(error.stderr ?? error.message) };
    }
}

/** Whether the refusal throws for `env`. */
function refuses(env) {
    try {
        assertTestBranchNotProduction(env);
        return false;
    } catch {
        return true;
    }
}

/** What a call answers, or that it threw — so a throw fails its own line and no later one. */
function answerOf(call) {
    try {
        return call();
    } catch (error) {
        return `threw: ${error.message}`;
    }
}

/** A workflow's text with its comment lines taken out, line endings made LF. */
function workflowCode(text) {
    return text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .join("\n");
}

/** Every branch a workflow's code names as `refs/heads/<name>`, each once. */
function refsNamed(code) {
    return [...new Set([...code.matchAll(/refs\/heads\/([\w./-]+)/g)].map((m) => m[1]))].sort();
}

/** The branches a workflow's push trigger lists, as `on: push: branches: [...]` writes them. */
function pushBranches(code) {
    const match = code.match(/^on:\n {2}push:\n {4}branches: \[([^\]]*)\]/m);
    return match ? match[1].split(",").map((name) => name.trim()).sort().join(" ") : null;
}

/** The lines of the top-level `permissions:` block, trimmed. */
function topPermissions(code) {
    const match = code.match(/^permissions:\n((?: {2}\S.*\n?)+)/m);
    return match ? match[1].split("\n").map((line) => line.trim()).filter(Boolean).join("; ") : null;
}

export async function run({ check, assert, log }) {
    // ── 1. the refusal, by value ────────────────────────────────────────────
    log("the branch, and the build that refuses it, by value:");
    check("  the test deployment's branch", TEST_DEPLOYMENT_BRANCH, BRANCH);
    for (const [label, env, stopped] of BUILDS) {
        check(`  ${label}: refused`, refuses(env), stopped);
    }
    log("");
    log("isPreviewDeployment holds a preview and nothing else:");
    check("  VERCEL_ENV=preview is a preview", isPreviewDeployment({ VERCEL_ENV: "preview" }), true);
    check("  read trimmed", isPreviewDeployment({ VERCEL_ENV: " preview\n" }), true);
    check("  production is not", isPreviewDeployment({ VERCEL_ENV: "production" }), false);
    check("  development is not", isPreviewDeployment({ VERCEL_ENV: "development" }), false);
    check("  no VERCEL_ENV is not — a local run", isPreviewDeployment({}), false);
    check("  another case is not", isPreviewDeployment({ VERCEL_ENV: "Preview" }), false);

    // ── 2. at build, end to end, and at no request ──────────────────────────
    log("");
    log("next.config.mjs, evaluated as a build with each environment evaluates it:");
    const builds = await Promise.all(BUILDS.map(async ([label, env, stopped]) => ({ label, stopped, ...(await evaluateConfig(env)) })));
    for (const { label, stopped, loaded, printed } of builds) {
        check(`  ${label}: the build goes on`, loaded, !stopped);
        if (stopped) assert(`    and it names the refusal`, printed.includes(REFUSAL_WORDS));
    }
    const preview = builds.find((b) => b.label === "the test deployment's own preview");
    check("  the test deployment's preview opens the materials screens", JSON.stringify(preview.answer), JSON.stringify({ MATERIALS_SCREENS_OPEN: "true" }));
    const main = builds.find((b) => b.label === "main's production build");
    check("  main's production build closes them", JSON.stringify(main.answer), JSON.stringify({ MATERIALS_SCREENS_OPEN: "false" }));

    log("");
    log("what a request runs answers the refused environment without throwing:");
    const liveKey = { ...REFUSED, AIRTABLE_API_KEY: "patLive" };
    const message = { from: "a@x", to: "b@x", subject: "s" };
    check("  isProductionDeployment answers production", answerOf(() => isProductionDeployment(REFUSED)), true);
    check("  resolveAirtableBase answers the live base", answerOf(() => resolveAirtableBase(liveKey).live), true);
    check("  routeMail hands production's mail on as built", answerOf(() => routeMail(message, {}, REFUSED) === message), true);
    check("  materialsScreensAtBuild answers closed", answerOf(() => materialsScreensAtBuild(REFUSED).env.MATERIALS_SCREENS_OPEN), "false");

    log("");
    log("the refusal has one call, at the top of next.config.mjs:");
    const corpus = [...["app", "lib"].flatMap((dir) => listJsFiles(repoPath(dir)).map(repoRelative)), "proxy.js", CONFIG].filter(
        (rel) => rel !== DEPLOYMENT
    );
    assert("  the app's files were read", corpus.length > 200);
    const calls = corpus.flatMap((rel) => callsTo(parseFile(rel).ast, REFUSAL).map((node) => ({ rel, node })));
    check(`  the calls of ${REFUSAL}`, calls.map((c) => c.rel).join(" "), CONFIG);
    // Read again, so the call and every node above it are of one tree.
    const { ast } = parseFile(CONFIG);
    const parents = parentMap(ast);
    const call = callsTo(ast, REFUSAL)[0];
    const above = [];
    for (let cur = call && parents.get(call); cur; cur = parents.get(cur)) above.push(cur);
    check("  inside no function", Boolean(call) && above.at(-1) === ast && !above.some(isFunctionNode), true);
    const statements = ast.body.filter((n) => n.type !== "ImportDeclaration");
    const first = statements[0];
    check(
        "  and before anything else the file does",
        first?.type === "ExpressionStatement" && first.expression === call,
        true
    );
    check("  handed no environment, so it reads the build's own", call?.arguments.length, 0);

    // ── 3. the workflow, read as text ───────────────────────────────────────
    log("");
    log(`${WORKFLOW}, read as text:`);
    const code = workflowCode(readFileSync(repoPath(WORKFLOW), "utf8"));
    check("  the branches it writes or reads", refsNamed(code).join(" "), BRANCH);
    check("  the push it runs on", pushBranches(code), ["main", BRANCH].sort().join(" "));
    assert("  and it runs by hand", /^on:\n(?: {2}.*\n|\n)*? {2}workflow_dispatch:/m.test(code));
    check("  its permission", topPermissions(code), "contents: write");
    check("  and no job grants another", (code.match(/permissions:/g) ?? []).length, 1);
    check("  it reads no secret", /secrets\.|token:/i.test(code), false);
    assert("  it checks main out afresh", /uses: actions\/checkout@v4\n\s+with:\n\s+ref: main\n/.test(code));
    assert("  and takes main from that checkout", code.includes('main=$(git rev-parse HEAD)'));
    assert("  the commit is main's tree under main's head", code.includes('git commit-tree "$main^{tree}" -p "$main"'));
    assert("  its message names main's short SHA", code.includes('short=$(git rev-parse --short=7 "$main")') && code.includes('-m "Test deployment of main $short"'));
    assert("  it is pushed over the branch", code.includes(`git push --force origin "$commit:refs/heads/${BRANCH}"`));
    assert("  one run at a time, none canceled", /^concurrency:\n {2}group: \S+\n {2}cancel-in-progress: false$/m.test(code));
    // ANTI-VACUITY: the readers find what they are handed, and a comment names nothing.
    check(
        "  the branch reader sees a planted ref and skips a comment",
        refsNamed(workflowCode("# refs/heads/commented\n  run: git push origin x:refs/heads/planted\n")).join(" "),
        "planted"
    );
    check("  the permission reader sees a planted second one", topPermissions("permissions:\n  contents: write\n  actions: write\n"), "contents: write; actions: write");
}

if (isMain(import.meta.url)) standalone(title, run);
