// The production deployment opens on Tools & Equipment alone, and every other build opens the
// materials screens too (#542, #631).
//
// THE BUILD THROWS THE SWITCH, SO THIS FILE BUILDS. `next.config.mjs` asks
// `lib/openScreens.js:materialsScreensAtBuild` once, takes its redirects from the answer and hands
// the answer to the app's own code, which Next inlines into every bundle. Nothing in this process
// was built, so each environment below is a child process handed that environment and no other —
// never a variable set on this one — and what this file expects is typed out by value where the
// issue decides it and taken from `lib/deployment.js` where that module does.
//
// SIX CLAIMS.
//   1. THE CLOSED SET IS THE MATERIALS SCREENS', TYPED OUT HERE: five sections' first
//      segments and the address form a request sends its writer to. Each is a segment the
//      app really serves pages under, so a renamed directory fails rather than leaving a
//      segment that closes nothing.
//   2. THE PRODUCTION DEPLOYMENT CLOSES THEM AND EVERY OTHER BUILD OPENS THEM, END TO END. Each
//      build is `next.config.mjs` evaluated in a child: its redirects and the answer it hands the
//      app. Then the app's own modules are started in a second child holding that answer, as Next
//      inlines it: the switch, its closed set and the rail's list (`lib/navigation.js`).
//      Production is held by value — six segments led away, `false` handed over, the rail Tools &
//      Equipment alone — and so is a build with no `VERCEL_ENV`, a preview and a development run,
//      open. Every environment follows `isProductionDeployment` and never reverses it or reads
//      `VERCEL_ENV` itself: production padded with spaces closes and another case opens, as that
//      module reads them, the second being its ambiguity read as not production.
//   3. AN ANSWER THE APP CANNOT READ IS CLOSED. Started with no answer, an empty one, `TRUE`,
//      `1` or ` true`, the app is closed; `true` alone opens it.
//   4. THE BUILD ASKS ONCE AND THE APP READS ITS ANSWER. `materialsScreensAtBuild` has one call,
//      in `next.config.mjs`; the module has two importers, that file and the rail's list, and
//      any other fails until it is classified here, since a page or a browser asking the
//      judgment is the second implementation of the closure this module exists to prevent; no
//      file but the module reads the inlined name; and no other file declares the switch.
//   5. THE REDIRECTS DO WHAT THEY SAY, IN BOTH BUILDS, MATCHED THE WAY NEXT MATCHES THEM. Each
//      source is compiled with the options `next/dist/server/lib/router-utils/filesystem.js`
//      gives a redirect. Every page the app serves under a closed segment leads to the landing
//      and no other page does; no Route Handler is touched; `/` leads to the landing; nothing is
//      permanent; and the landing itself is open, so nothing loops.
//   6. `isOpenAddress` MATCHES A SEGMENT WHOLE, past a query and a hash.
//
// WHAT IT CANNOT SEE: Next's own inlining, which a child stands in for by holding the answer in
// its environment — the production build walked in the pull request is what shows the browser's
// rail closed; the response — the status a browser receives, that the query is carried, that a
// signed-out reader then reaches `/login` with the list as the destination; whether Vercel builds
// the deployment it serves as production with `VERCEL_ENV=production`; and whether a later Next
// compiles a redirect the way 16.2.10 does, which the matcher here is copied from rather than
// imported whole.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { CLOSED_SEGMENTS, MATERIALS_SCREENS_OPEN, firstSegment, isOpenAddress } from "../../../lib/openScreens.js";
import { isProductionDeployment } from "../../../lib/deployment.js";
import { DEFAULT_DESTINATION } from "../../../lib/loginDestination.js";
import { callsTo, listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isPageFile, isRouteFile, routeTemplate } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The materials screens open on every build but production's (#542, #631)";

/** The first segments of the materials screens, by value. */
const MATERIALS_SEGMENTS = ["prs", "pos", "invoices", "deliveries", "materials", "addresses"];

/** The rail's sections, by key: every one, and the production deployment's. */
const ALL_SECTIONS = "purchase-requests purchase-orders invoices deliveries assets material-prices";
const PRODUCTION_SECTIONS = "assets";

/** The module, the one call of its judgment, and the two files allowed to import it. */
const SWITCH = "lib/openScreens.js";
const JUDGMENT = "materialsScreensAtBuild";
const ANSWER = "MATERIALS_SCREENS_OPEN";
const READERS = {
    "lib/navigation.js": "isOpenAddress",
    "next.config.mjs": JUDGMENT,
};

/** The builds: what each is called, its environment, and what the issue decides for it. */
const BUILDS = [
    ["the production deployment", { VERCEL_ENV: "production" }, "closed"],
    ["a build with no VERCEL_ENV, as next dev and a local build are", {}, "open"],
    ["a preview", { VERCEL_ENV: "preview" }, "open"],
    ["a development run", { VERCEL_ENV: "development" }, "open"],
    ["production padded with spaces", { VERCEL_ENV: " production\n" }, null],
    ["production in another case", { VERCEL_ENV: "Production" }, null],
];

/** Answers the app is started with that it cannot read, and must read as closed. */
const UNREADABLE = [
    ["no answer at all", {}],
    ["an empty answer", { [ANSWER]: "" }],
    ["TRUE", { [ANSWER]: "TRUE" }],
    ["1", { [ANSWER]: "1" }],
    ["a padded true", { [ANSWER]: " true" }],
];

/** Addresses that are no page's and must still lead nowhere else. */
const UNTOUCHED = [
    "/api/files/quotations/x/y.pdf",
    "/api/pos/search",
    "/api/auth/logout",
    "/l/260909-004",
    "/L/260909-004",
    "/_next/static/chunks/x.js",
    "/prs-archive/1",
    "/materialsx",
    "/assets/HYE-AST-260909-001?from=/prs",
];

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const addressOf = (template) => template.replace(/\[[^\]]+\]/g, "sample1");
const urlOf = (rel) => JSON.stringify(pathToFileURL(repoPath(rel)).href);

/** What a child process is handed besides its case: enough to start, and no `VERCEL_ENV`. */
const CHILD_BASE = Object.fromEntries(
    ["PATH", "SystemRoot"].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]])
);

/** The config as a build with this environment evaluates it: its redirects and its `env`. */
const BUILD_SCRIPT = `
const { default: config } = await import(${urlOf("next.config.mjs")});
process.stdout.write(JSON.stringify({ env: config.env ?? null, redirects: await config.redirects() }));
`;

/** The app's own modules, started with whatever answer the environment holds. */
const APP_SCRIPT = `
const screens = await import(${urlOf(SWITCH)});
const navigation = await import(${urlOf("lib/navigation.js")});
process.stdout.write(JSON.stringify({
    open: screens.${ANSWER},
    closed: screens.CLOSED_SEGMENTS,
    rail: navigation.NAVIGATION_SECTIONS.map((section) => section.key),
}));
`;

const execFileAsync = promisify(execFile);

/** Runs a script in a child holding `env` and nothing else of this process's, and reads its JSON. */
async function inChild(script, env) {
    const { stdout } = await execFileAsync(process.execPath, ["--no-warnings", "--input-type=module", "-e", script], {
        cwd: REPO_ROOT,
        env: { ...CHILD_BASE, ...env },
        encoding: "utf8",
        windowsHide: true,
    });
    return JSON.parse(stdout);
}

/** The first segments a config's redirects lead away from, `/` aside. */
const ledAway = (redirects) =>
    redirects
        .map((r) => r.source)
        .filter((source) => source !== "/")
        .map(firstSegment)
        .join(" ");

/**
 * A redirect's matcher, built as Next 16.2.10 builds one for the router (`buildCustomRoute`
 * in `next/dist/server/lib/router-utils/filesystem.js`): strict, case-insensitive, with
 * `/_next` excluded and a trailing slash allowed.
 */
function nextRedirectMatcher() {
    const require = createRequire(repoPath("package.json"));
    const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match.js");
    const { modifyRouteRegex } = require("next/dist/lib/redirect-status.js");
    return (source) =>
        getPathMatch(source, {
            strict: true,
            removeUnnamedParams: true,
            regexModifier: (regex) => modifyRouteRegex(regex, ["/_next"]),
            sensitive: false,
        });
}

/** Local names a file imports from a module path ending with `suffix`. */
function importedFrom(ast, suffix) {
    return ast.body
        .filter((n) => n.type === "ImportDeclaration" && String(n.source.value).replace(/\.js$/, "").endsWith(suffix))
        .flatMap((n) => n.specifiers.map((spec) => spec.imported?.name ?? spec.local.name));
}

/** Reads of `process.env.<ANSWER>` in a file, dotted or bracketed. */
function answerReads(ast) {
    let reads = 0;
    walk(ast, (n) => {
        if (n.type !== "MemberExpression") return;
        const name = n.computed ? n.property?.value : n.property?.name;
        const onEnv =
            n.object?.type === "MemberExpression" &&
            n.object.object?.name === "process" &&
            (n.object.property?.name ?? n.object.property?.value) === "env";
        if (onEnv && name === ANSWER) reads += 1;
    });
    return reads;
}

export async function run({ check, assert, log }) {
    const pageFiles = listJsFiles(repoPath("app")).map(repoRelative).filter(isPageFile);
    const pages = pageFiles.map(routeTemplate).sort();
    const handlers = listJsFiles(repoPath("app")).map(repoRelative).filter(isRouteFile).map(routeTemplate).sort();

    // Every build, and the app as each one's answer starts it — run side by side.
    const builds = await Promise.all(
        BUILDS.map(async ([label, env, decided]) => {
            const config = await inChild(BUILD_SCRIPT, env);
            const app = await inChild(APP_SCRIPT, config.env ?? {});
            return { label, env, decided, config, app };
        })
    );
    const unreadable = await Promise.all(UNREADABLE.map(async ([label, env]) => ({ label, app: await inChild(APP_SCRIPT, env) })));

    // ── 2: every build, end to end ──────────────────────────────────────────
    log("the production deployment closes the materials screens, and every other build opens them:");
    const production = builds[0];
    check("  the production deployment hands the app", JSON.stringify(production.config.env), JSON.stringify({ [ANSWER]: "false" }));
    check("  and leads away from", ledAway(production.config.redirects), MATERIALS_SEGMENTS.join(" "));
    check("  and the app it starts is closed", production.app.open, false);
    check("  with the closed set", production.app.closed.join(" "), MATERIALS_SEGMENTS.join(" "));
    check("  and the rail carries", production.app.rail.join(" "), PRODUCTION_SECTIONS);
    for (const { label, config, app } of builds.slice(1).filter((b) => b.decided === "open")) {
        check(`  ${label} hands the app`, JSON.stringify(config.env), JSON.stringify({ [ANSWER]: "true" }));
        check(`  ${label} leads away from`, ledAway(config.redirects), "");
        check(`  the app ${label} starts is open`, app.open, true);
        check(`  and its rail carries`, app.rail.join(" "), ALL_SECTIONS);
    }
    log("");
    log("each build follows lib/deployment.js, neither reversing it nor reading VERCEL_ENV itself:");
    for (const { label, env, config, app } of builds) {
        const open = !isProductionDeployment(env);
        check(`  ${label}: the answer`, JSON.stringify(config.env), JSON.stringify({ [ANSWER]: String(open) }));
        check(`  ${label}: led away from`, ledAway(config.redirects), open ? "" : MATERIALS_SEGMENTS.join(" "));
        check(`  ${label}: the app's rail`, app.rail.join(" "), open ? ALL_SECTIONS : PRODUCTION_SECTIONS);
    }
    check("  padded production is production there", isProductionDeployment(BUILDS[4][1]), true);
    check("  and another case is not", isProductionDeployment(BUILDS[5][1]), false);

    // ── 3: an answer the app cannot read ────────────────────────────────────
    log("");
    log("an answer the app cannot read is closed:");
    for (const { label, app } of unreadable) {
        check(`  started with ${label}, the app's switch`, app.open, false);
        check(`  and its rail carries`, app.rail.join(" "), PRODUCTION_SECTIONS);
    }

    // ── 1: the closed set ───────────────────────────────────────────────────
    log("");
    log(`this process was handed no answer, so it reads the screens ${MATERIALS_SCREENS_OPEN ? "open" : "closed"}:`);
    check("  the closed segments", CLOSED_SEGMENTS.join(" "), MATERIALS_SCREENS_OPEN ? "" : MATERIALS_SEGMENTS.join(" "));
    for (const segment of MATERIALS_SEGMENTS) {
        assert(`  /${segment} is a segment the app serves pages under`, pages.some((route) => firstSegment(route) === segment));
    }
    assert("  the app's pages and its handlers were read", pages.length > 20 && handlers.length > 5);

    // ── 4: one question, two readers ────────────────────────────────────────
    log("");
    log("the build asks once, and the app reads its answer:");
    const corpus = [
        ...["app", "lib"].flatMap((dir) => listJsFiles(repoPath(dir)).map(repoRelative)),
        "proxy.js",
        "next.config.mjs",
    ].filter((rel) => rel !== SWITCH);
    const callers = corpus.flatMap((rel) => callsTo(parseFile(rel).ast, JUDGMENT).map(() => rel));
    check(`  the calls of ${JUDGMENT}`, callers.join(" "), "next.config.mjs");
    const readers = corpus.filter((rel) => importedFrom(parseFile(rel).ast, "openScreens").length > 0).sort();
    check("  the files importing the module", readers.join(" "), Object.keys(READERS).sort().join(" "));
    for (const [rel, name] of Object.entries(READERS)) {
        const { ast } = parseFile(rel);
        assert(`  ${rel} imports ${name}`, importedFrom(ast, "openScreens").includes(name));
        // A use outside the import declarations is the read.
        let used = 0;
        for (const node of ast.body.filter((n) => n.type !== "ImportDeclaration")) {
            walk(node, (n) => {
                if (n.type === "Identifier" && n.name === name) used += 1;
            });
        }
        assert(`    and uses it`, used >= 1);
    }
    assert("  the rail's list filters by the predicate", callsTo(parseFile("lib/navigation.js").ast, "isOpenAddress").length >= 1);
    const answerReaders = corpus.filter((rel) => answerReads(parseFile(rel).ast) > 0);
    check(`  no other file reads process.env.${ANSWER}`, answerReaders.join(" "), "");
    // Anti-vacuity: the reader finds the module's own read, and planted reads in both spellings.
    check("  the module's own read is seen", answerReads(parseFile(SWITCH).ast), 1);
    check(
        "  and planted reads, bracketed and dotted",
        answerReads(parseSource(`const a = process.env["${ANSWER}"]; const b = process["env"].${ANSWER}; const c = env.${ANSWER};`).ast),
        2
    );
    // Nothing else declares a switch of its own under the same name.
    const declared = corpus.filter((rel) => {
        let found = false;
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === ANSWER) found = true;
        });
        return found;
    });
    check("  no other file declares the switch", declared.join(" "), "");

    // ── 5: the redirects, in both builds ────────────────────────────────────
    const match = nextRedirectMatcher();
    for (const { label, config } of [builds[0], builds[1]]) {
        log("");
        log(`the redirects of ${label}, matched as Next matches them:`);
        const { redirects } = config;
        const closed = ledAway(redirects).split(" ").filter(Boolean);
        const matchers = redirects.map((r) => ({ ...r, matches: match(r.source) }));
        const ledTo = (address) => {
            const path = address.split(/[?#]/)[0];
            const hit = matchers.find((r) => r.matches(path) !== false);
            return hit ? hit.destination : null;
        };

        check("  every redirect is temporary", redirects.filter((r) => r.permanent !== false || "statusCode" in r).length, 0);
        check("  and every one leads to the landing", redirects.filter((r) => r.destination !== DEFAULT_DESTINATION).length, 0);
        check("  no source is under /api", redirects.filter((r) => r.source.startsWith("/api")).length, 0);
        check("  `/` leads to the landing", ledTo("/"), DEFAULT_DESTINATION);
        check("  the landing is not closed", closed.includes(firstSegment(DEFAULT_DESTINATION)), false);
        check("  and leads nowhere else, so nothing loops", ledTo(DEFAULT_DESTINATION), null);
        check("  the landing is a page the app serves", pages.includes(DEFAULT_DESTINATION), true);

        for (const route of pages) {
            check(`  ${route}`, ledTo(addressOf(route)), closed.includes(firstSegment(route)) ? DEFAULT_DESTINATION : null);
        }
        for (const segment of closed) {
            check(`  /${segment} several levels down`, ledTo(`/${segment}/a/b/c`), DEFAULT_DESTINATION);
        }
        const handlersLed = handlers.filter((route) => ledTo(addressOf(route)) !== null);
        check("  no Route Handler is led anywhere", handlersLed.join(" "), "");
        for (const address of UNTOUCHED) check(`  ${address}`, ledTo(address), null);
    }
    // Anti-vacuity: the matcher says yes to a source it was handed, so the nulls above are
    // answers rather than a matcher that matches nothing.
    assert("  the matcher answers a planted source", match("/planted/:path*")("/planted/x") !== false);
    assert("  and refuses a neighbor of it", match("/planted/:path*")("/plantedx") === false);

    // ── 6: the predicate ────────────────────────────────────────────────────
    log("");
    log("`isOpenAddress` reads the first segment whole:");
    check("  the landing", isOpenAddress("/asset-categories"), true);
    check("  an asset", isOpenAddress("/assets/HYE-AST-260909-001"), true);
    check("  a prefix of a closed segment", isOpenAddress("/prs-archive"), true);
    for (const segment of MATERIALS_SEGMENTS) {
        check(`  /${segment}/x?q=1#top`, isOpenAddress(`/${segment}/x?q=1#top`), MATERIALS_SCREENS_OPEN);
        check(`  /${segment}?mine=1`, isOpenAddress(`/${segment}?mine=1`), MATERIALS_SCREENS_OPEN);
    }
    check("  the segment of a template", firstSegment(posix.join("/", "assets", "[assetId]")), "assets");
}

if (isMain(import.meta.url)) standalone(title, run);
