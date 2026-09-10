// Every address on the tools axis, and the one the label will carry (#348).
//
// WHAT THIS FILE IS FOR. A moved route breaks nothing a compiler or a lint run can
// see: a `<Link>` to an address the app stopped serving renders exactly as it did
// and is a 404 only when somebody clicks it. This issue moved three of them, so the
// thing worth holding afterwards is that the builders in `lib/toolRoutes.js` and the
// page files under `app/(tools)/` name the same five routes, in both directions.
//
// THE SECOND CLAIM IS THE ONE WITH A REDIRECT BEHIND IT. `/t/` uppercases the id it
// was handed so the tool item's own page does not have to redirect a second time,
// and that shortcut is only correct while every minted `Tool Item ID` is already
// uppercase. That is a fact about `lib/idSequence.js` rather than an assumption, so
// it is asserted against the generator: the ids this check compares are the ones
// `formatSequentialId` produces, not literals someone typed here.
//
// AND THE THIRD IS A FILE NOTHING ELSE IN THIS TIER READS. A rewrite lives in
// `next.config.mjs`, which no check parses and no test renders — so the uppercase
// alias `/T/` could be deleted, or point at a route that does not exist, and every
// other check would stay green. This one compares that file's literals against the
// module's.
//
// WHAT IT CANNOT SEE. Whether the rewrite works, which is a fact about the running
// server; whether a redirect is 307 or 308, which is a fact about the response; and
// how many hops a scan costs, which is the claim this issue rests on and is checked
// in a browser once and recorded in the pull request. This tier reads source.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { ID_KINDS, dailyIdPrefix, formatSequentialId } from "../../../lib/idSequence.js";
import {
    LABEL_REWRITE,
    QR_ROUTE,
    REGISTER_PATH,
    TOOLS_PATH,
    TOOLS_ROUTES,
    canonicalToolItemId,
    labelPath,
    toolItemPath,
    toolItemQRPath,
    toolPath,
} from "../../../lib/toolRoutes.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isPageFile, isRouteFile, routeTemplate } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every address on the tools axis, and the label's own (#348)";

/** The route group the whole axis lives in, so one layout holds its width. */
const GROUP_DIR = "app/(tools)";

/** Addresses this issue retired. Nothing under app/ or lib/ may still name one. */
const RETIRED = ["/tools/tool/", "/tools/[toolItemId]"];

/** Every `.js` under app/, repo-relative and posix-separated. */
function appFiles() {
    const out = [];
    listJsFiles(repoPath("app"), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

/** Every string literal, template quasi and JSX text in a file. */
function allText(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
        if (n.type === "JSXText") out.push(n.value);
    });
    return out;
}

export function run({ check, assert, log }) {
    // ── 1: the routes the module names are the routes the app serves ────────
    log("the builders and the page files name the same routes:");

    const served = appFiles()
        .filter((rel) => rel.startsWith(`${GROUP_DIR}/`))
        .filter(isPageFile)
        .map(routeTemplate)
        .sort();
    const declared = [...TOOLS_ROUTES].sort();

    check(`${served.length} pages under ${GROUP_DIR}/`, served.join(" | "), declared.join(" | "));
    assert("and the axis has more than one", served.length > 1);

    // Nothing in the group's own path reaches the URL, which is the property the
    // group was added for: one layout over three collections, no segment.
    assert(
        "no route carries the group's parentheses",
        served.every((route) => !route.includes("(") && !route.includes(")"))
    );
    // ANTI-VACUITY: the deriver is seen stripping one, on a path written out here
    // rather than taken from the tree — a tree with no group would pass the line
    // above by having nothing to strip.
    check(
        "  the deriver strips a route group it is shown",
        routeTemplate("app/(tools)/tool-items/[toolItemId]/page.js"),
        "/tool-items/[toolItemId]"
    );
    check("  and leaves a route with none alone", routeTemplate("app/pos/[poId]/page.js"), "/pos/[poId]");
    check("  and still answers for the root", routeTemplate("app/page.js"), "/");

    // ── 2: the builders build those routes ──────────────────────────────────
    log("");
    log("each builder lands on the route it is for:");
    check("the tool list", TOOLS_PATH, "/tools");
    check("the registration form", REGISTER_PATH, "/tools/new");
    check("one tool", toolPath("recAbc"), "/tools/recAbc");
    check("  a later page of it", toolPath("recAbc", 2), "/tools/recAbc?page=2");
    check("  and page 1 carries no parameter", toolPath("recAbc", 1), "/tools/recAbc");
    check("one tool item", toolItemPath("HYE-TL-260909-004"), "/tool-items/HYE-TL-260909-004");
    check("the label's own", labelPath("HYE-TL-260909-004"), "/t/HYE-TL-260909-004");
    for (const [name, built] of [
        ["toolPath", toolPath("rec/A b")],
        ["toolItemPath", toolItemPath("HYE/A b")],
        ["labelPath", labelPath("HYE/A b")],
    ])
        assert(`  ${name} encodes its segment`, built.includes("%2F") && built.includes("%20"));

    // THE PRINTED PATH IS THE SHORTEST ONE THE AXIS HAS, which is the whole reason
    // it exists. Asserted as a relation rather than as a length, so it survives a
    // rename of either.
    assert(
        "the label's path is shorter than the screen it opens",
        labelPath("HYE-TL-260909-004").length < toolItemPath("HYE-TL-260909-004").length
    );

    // ── 3: the canonical form of a printed id ───────────────────────────────
    log("");
    log("`/t/` can uppercase because a minted id is already uppercase:");

    // Straight from the generator, so this cannot drift from what the base holds.
    const prefix = dailyIdPrefix(ID_KINDS.TOOL_ITEM, new Date(2026, 8, 9));
    const minted = [1, 9, 42, 999, 1000].map((seq) =>
        formatSequentialId(prefix, seq, { padLength: ID_KINDS.TOOL_ITEM.padLength })
    );
    assert(`${minted.length} ids minted, first ${minted[0]}`, minted.length === 5);
    check(
        "every one equals its own canonical form",
        minted.filter((id) => canonicalToolItemId(id) !== id).length,
        0
    );
    // ANTI-VACUITY: the comparison is seen rejecting something, so the zero above is
    // a fact about the generator rather than about a function that returns its input.
    assert(
        "  and the canonical form is not the identity",
        canonicalToolItemId("hye-tl-260909-004") === "HYE-TL-260909-004"
    );
    check(
        "a typed lowercase id canonicalizes",
        canonicalToolItemId(minted[0].toLowerCase()),
        minted[0]
    );
    check("  surrounding space goes", canonicalToolItemId("  HYE-TL-260909-004 "), "HYE-TL-260909-004");
    check("  and it is idempotent", canonicalToolItemId(canonicalToolItemId("hye-tl-260909-004")), "HYE-TL-260909-004");

    // ── 4: the uppercase alias, which lives outside this tier's reach ───────
    log("");
    log("`next.config.mjs` rewrites the uppercase spelling to the route:");
    const config = readFileSync(repoPath("next.config.mjs"), "utf8");
    assert(`the rewrite source is \`${LABEL_REWRITE.source}\``, config.includes(`"${LABEL_REWRITE.source}"`));
    assert(`  and it lands on \`${LABEL_REWRITE.destination}\``, config.includes(`"${LABEL_REWRITE.destination}"`));
    assert("  through rewrites() rather than redirects()", /async rewrites\(\)/.test(config) && !/redirects\(\)/.test(config));
    // The destination has to be a route the app serves, or the alias is a 404 that
    // only a scan of an uppercase label would ever find.
    check(
        "  and that destination is one of the routes above",
        LABEL_REWRITE.destination.replace(/:(\w+)/g, "[$1]"),
        "/t/[toolItemId]"
    );
    // Uppercasing the whole URL is what the alias buys, so the source has to BE the
    // uppercase of the route rather than merely differ from it.
    check(
        "  the source is the destination uppercased",
        LABEL_REWRITE.source,
        LABEL_REWRITE.destination.replace("/t/", "/T/")
    );

    // ── 5: nothing still names a retired address ────────────────────────────
    log("");
    log("no file names an address this issue retired:");
    const residue = [];
    for (const rel of appFiles().concat(libFiles())) {
        for (const text of allText(parseFile(rel).ast)) {
            for (const gone of RETIRED) if (text.includes(gone)) residue.push(`${rel}: ${text.trim().slice(0, 40)}`);
        }
    }
    check(
        `${RETIRED.join(" and ")} appear nowhere${residue.length ? ` (${residue.join("; ")})` : ""}`,
        residue.length,
        0
    );
    // ANTI-VACUITY: the detector is seen finding a planted one, so the zero is a
    // fact about the tree rather than about a walk that visits nothing.
    const planted = allText(
        parseSource('const href = `/tools/tool/${id}`;\n', "<planted-retired>").ast
    );
    assert(
        "  the detector sees a planted one",
        planted.some((t) => RETIRED.some((gone) => t.includes(gone)))
    );

    // ── 6: the axis's one Route Handler address (#351) ──────────────────────
    // NOT IN `TOOLS_ROUTES`, because that list is compared against page files and
    // this answers no page. Held in the same two directions against its own
    // `route.js` — a builder pointing at an address nothing serves is a broken
    // `<img>`, which renders as a missing image rather than as an error.
    log("");
    log("the QR endpoint's address is the route its handler serves:");
    check("the builder lands on the route", toolItemQRPath("HYE-TL-260909-004"), "/api/tool-items/HYE-TL-260909-004/qr");
    assert("  and it encodes its segment", toolItemQRPath("HYE/A b").includes("%2F"));
    check("the template the module declares", QR_ROUTE, "/api/tool-items/[toolItemId]/qr");
    check(
        "  is derived from the handler's own path",
        routeTemplate("app/api/tool-items/[toolItemId]/qr/route.js"),
        QR_ROUTE
    );
    const qrHandlers = appFiles().filter(isRouteFile).filter((rel) => routeTemplate(rel) === QR_ROUTE);
    check(`${QR_ROUTE} is served by exactly one route.js`, qrHandlers.length, 1);
    // The builder and the template cannot disagree: substituting the segment into
    // the template has to produce what the builder built.
    check(
        "  and the builder is that template with the segment filled in",
        toolItemQRPath("HYE-TL-260909-004"),
        QR_ROUTE.replace("[toolItemId]", "HYE-TL-260909-004")
    );
    // ANTI-VACUITY: the enumeration is seen finding OTHER Route Handlers, so the
    // one above is a hit rather than the only thing the filter can match.
    assert("  the route enumeration sees the rest of app/api/ too", appFiles().filter(isRouteFile).length > 5);
}

/** Every `.js` under lib/, repo-relative and posix-separated. */
function libFiles() {
    const out = [];
    listJsFiles(repoPath("lib"), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

if (isMain(import.meta.url)) standalone(title, run);
