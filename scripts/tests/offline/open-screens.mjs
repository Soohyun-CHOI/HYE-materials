// The app opens on Tools & Equipment alone until the materials screens are in use (#542).
//
// ONE SWITCH, `lib/openScreens.js:MATERIALS_SCREENS_OPEN`, AND EVERYTHING HERE FOLLOWS IT.
// What this file expects is computed from the switch's value, so setting it true opens the
// rail and the addresses together with no edit here — which is the property the issue asks
// for, and the reason nothing below holds the switch itself by value.
//
// FOUR CLAIMS.
//   1. THE CLOSED SET IS THE MATERIALS SCREENS', TYPED OUT HERE: five sections' first
//      segments and the address form a request sends its writer to. Each is a segment the
//      app really serves pages under, so a renamed directory fails rather than leaving a
//      segment that closes nothing.
//   2. THE SWITCH HAS TWO READERS AND NO MORE. The rail's list (`lib/navigation.js`) and the
//      config's redirects (`next.config.mjs`) import the module and take the closed set or
//      the predicate from it; any other file importing it fails until it is classified
//      here, since a page asking the switch itself is the second implementation of the
//      closure this module exists to prevent.
//   3. THE REDIRECTS DO WHAT THEY SAY, ASKED OF THE CONFIG ITSELF AND MATCHED THE WAY NEXT
//      MATCHES THEM. `next.config.mjs` is imported and its `redirects()` called, and each
//      source is compiled with the options `next/dist/server/lib/router-utils/filesystem.js`
//      gives a redirect. Every page the app serves under a closed segment leads to the
//      landing and no other page does; no Route Handler is touched; `/` leads to the
//      landing; nothing is permanent; and the landing itself is open, so nothing loops.
//   4. `isOpenAddress` MATCHES A SEGMENT WHOLE, past a query and a hash.
//
// WHAT IT CANNOT SEE: the response — the status a browser receives, that the query is
// carried, that a signed-out reader then reaches `/login` with the list as the destination.
// Those are a running server's, walked in a browser and recorded in the pull request. And
// whether a later Next compiles a redirect the way 16.2.10 does, which the matcher here is
// copied from rather than imported whole.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { createRequire } from "node:module";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import { CLOSED_SEGMENTS, MATERIALS_SCREENS_OPEN, firstSegment, isOpenAddress } from "../../../lib/openScreens.js";
import { DEFAULT_DESTINATION } from "../../../lib/loginDestination.js";
import { callsTo, listJsFiles, parseFile, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isPageFile, isRouteFile, routeTemplate } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The app opens on Tools & Equipment alone until the materials screens are in use (#542)";

/** The first segments of the materials screens, by value. */
const MATERIALS_SEGMENTS = ["prs", "pos", "invoices", "deliveries", "materials", "addresses"];

/** The module, and the two files allowed to read it, with what each takes. */
const SWITCH = "lib/openScreens.js";
const READERS = {
    "lib/navigation.js": "isOpenAddress",
    "next.config.mjs": "CLOSED_SEGMENTS",
};

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

export async function run({ check, assert, log }) {
    const pageFiles = listJsFiles(repoPath("app")).map(repoRelative).filter(isPageFile);
    const pages = pageFiles.map(routeTemplate).sort();
    const handlers = listJsFiles(repoPath("app")).map(repoRelative).filter(isRouteFile).map(routeTemplate).sort();

    // ── 1: the closed set ───────────────────────────────────────────────────
    log(`the materials screens are ${MATERIALS_SCREENS_OPEN ? "open" : "closed"}, and the closed set follows:`);
    check("  the closed segments", CLOSED_SEGMENTS.join(" "), MATERIALS_SCREENS_OPEN ? "" : MATERIALS_SEGMENTS.join(" "));
    for (const segment of MATERIALS_SEGMENTS) {
        assert(`  /${segment} is a segment the app serves pages under`, pages.some((route) => firstSegment(route) === segment));
    }
    assert("  the app's pages and its handlers were read", pages.length > 20 && handlers.length > 5);

    // ── 2: two readers ──────────────────────────────────────────────────────
    log("");
    log("the switch has two readers, each taking what decides from it:");
    const corpus = [
        ...["app", "lib"].flatMap((dir) => listJsFiles(repoPath(dir)).map(repoRelative)),
        "proxy.js",
        "next.config.mjs",
    ].filter((rel) => rel !== SWITCH);
    const readers = corpus.filter((rel) => importedFrom(parseFile(rel).ast, "openScreens").length > 0).sort();
    check("  the files importing it", readers.join(" "), Object.keys(READERS).sort().join(" "));
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
    // Nothing else declares a switch of its own under the same name.
    const declared = corpus.filter((rel) => {
        let found = false;
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === "MATERIALS_SCREENS_OPEN") found = true;
        });
        return found;
    });
    check("  no other file declares the switch", declared.join(" "), "");

    // ── 3: the redirects, asked of the config ───────────────────────────────
    log("");
    log("`next.config.mjs` leads `/` and every closed page to the landing, and nothing else:");
    const { default: nextConfig } = await import(pathToFileURL(repoPath("next.config.mjs")).href);
    const redirects = await nextConfig.redirects();
    const match = nextRedirectMatcher();
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
    check("  the landing is open", isOpenAddress(DEFAULT_DESTINATION), true);
    check("  and leads nowhere else, so nothing loops", ledTo(DEFAULT_DESTINATION), null);
    check("  the landing is a page the app serves", pages.includes(DEFAULT_DESTINATION), true);

    for (const route of pages) {
        const closed = CLOSED_SEGMENTS.includes(firstSegment(route));
        check(`  ${route}`, ledTo(addressOf(route)), closed ? DEFAULT_DESTINATION : null);
    }
    for (const segment of CLOSED_SEGMENTS) {
        check(`  /${segment} several levels down`, ledTo(`/${segment}/a/b/c`), DEFAULT_DESTINATION);
    }
    const handlersLed = handlers.filter((route) => ledTo(addressOf(route)) !== null);
    check("  no Route Handler is led anywhere", handlersLed.join(" "), "");
    for (const address of UNTOUCHED) check(`  ${address}`, ledTo(address), null);
    // Anti-vacuity: the matcher says yes to a source it was handed, so the nulls above are
    // answers rather than a matcher that matches nothing.
    assert("  the matcher answers a planted source", match("/planted/:path*")("/planted/x") !== false);
    assert("  and refuses a neighbor of it", match("/planted/:path*")("/plantedx") === false);

    // ── 4: the predicate ────────────────────────────────────────────────────
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
