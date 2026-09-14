// A signed-out reader returns to where they were, and cannot be sent out of the
// app (#373).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. The sign-in flow now carries an
// address across four hops and a mail round trip, and every one of those hops
// fails SILENTLY: a destination that stops being carried lands the reader on the
// root screen, which is exactly where they landed before this issue, so nothing
// renders wrong, nothing throws, and nobody finds out except the person holding a
// phone in front of a tool. The second failure is louder in consequence and just
// as quiet in the tree — a destination that stops being judged is an open
// redirect, and an open redirect looks like a working feature.
//
//   SO THE ASSERTIONS ARE ABOUT CALL SITES AND ARGUMENTS, NOT ABOUT VALUES. Five
//   issues on this axis wrote a check in terms of the constant it was checking
//   and watched the mutation pass (#351's quiet-zone assertions are the worked
//   example, in `docs/notes/verification.md`). Here the trap is sharper than
//   usual: `proxy.js` and `lib/authz.js` import the header's NAME from one
//   module, so asserting that name is worth nothing at all — rename it and both
//   sides move together, green. What is asserted instead is that the stamping
//   call takes that imported identifier, that the reading call takes it too, and
//   that the redirect's argument is a value the predicate produced.
//
//   AND THE PREDICATE ITSELF IS ASSERTED BY BEHAVIOR, because it is pure and its
//   whole job is a verdict: the origin-escaping forms are the ones an open
//   redirect is attempted with, so they are written out as inputs rather than
//   derived from anything this module exports.
//
// WHAT A PASS DOES NOT PROVE. That a redirect happens — this tier reads source
// and never issues a request, so the browser walk is what proves a reader
// actually arrives, and it is recorded in the pull request. Nor that the mail
// carries the link: no check here can read a delivered message, and what closes
// that hop is that `lib/auth.js` builds the mail's URL from the same builder this
// file holds. Nor that `proxy.js` runs at all, which is a fact about the
// framework's own file conventions.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import {
    CONFIRM_PATH,
    DEFAULT_DESTINATION,
    DESTINATION_PARAM,
    REQUEST_PATH_HEADER,
    SIGN_IN_PATH,
    confirmPath,
    safeDestination,
    signInPath,
} from "../../../lib/loginDestination.js";
import { callsTo, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isRouteFile, listEntryPoints } from "./_entrypoints.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A signed-out reader returns to where they were (#373)";

/** The module every spelling of the parameter and the header comes from. */
const OWNER = "loginDestination";

/** What a proxy may never become. `lib/authz.js` has the helper for each. */
const GATE_NAMES = [
    "requireUser",
    "requireRole",
    "requireAdmin",
    "requirePresident",
    "requireAdminApi",
    "getActiveUser",
    "getCurrentUser",
    "canViewPR",
];

// ---------------------------------------------------------------------------
// reading the source
// ---------------------------------------------------------------------------

/** Local names this file imports from a module whose path ends with `suffix`. */
function importedFrom(ast, suffix) {
    const names = new Set();
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue;
        if (!String(node.source.value).endsWith(suffix)) continue;
        for (const spec of node.specifiers) names.add(spec.local.name);
    }
    return names;
}

/** Every module this file imports from. */
function importSources(ast) {
    return ast.body.filter((n) => n.type === "ImportDeclaration").map((n) => String(n.source.value));
}

/** Every `x.<property>(…)` call in a subtree. */
function memberCalls(node, property) {
    const out = [];
    walk(node, (n) => {
        if (
            n.type === "CallExpression" &&
            n.callee?.type === "MemberExpression" &&
            n.callee.property?.type === "Identifier" &&
            n.callee.property.name === property
        )
            out.push(n);
    });
    return out;
}

/** The initializer of a local `const name = …` inside a function, or null. */
function localInit(fn, name) {
    let init = null;
    walk(fn, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.id.name === name && n.init)
            init = n.init;
    });
    return init;
}

/**
 * Does this expression reach a call to `name`, following local bindings?
 *
 * ONE HOP THROUGH A `const` IS THE WHOLE POINT. `seeOther(destination ?? "/")`
 * says nothing on its own; what makes it safe is that `destination` was declared
 * as `safeDestination(...)` a few lines up. A check that only looked at the
 * argument would pass a raw form value written the same shape, which is the
 * mutant this function exists to catch.
 */
function reaches(fn, node, name) {
    if (!node) return false;
    if (node.type === "Identifier") {
        const init = localInit(fn, node.name);
        return init ? reaches(fn, init, name) : false;
    }
    if (node.type === "LogicalExpression" || node.type === "ConditionalExpression") {
        const branches = node.type === "LogicalExpression" ? [node.left, node.right] : [node.consequent, node.alternate];
        return branches.some((b) => reaches(fn, b, name));
    }
    if (node.type === "JSXExpressionContainer") return reaches(fn, node.expression, name);
    return callsTo(node, name).length > 0;
}

/** Every `<elementName …>` opening tag in a subtree. */
function jsxElements(node, elementName) {
    const out = [];
    walk(node, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === elementName) out.push(n);
    });
    return out;
}

/** The value expression of one opening tag's `name` attribute, or null. */
function attrValue(element, attrName) {
    for (const attr of element?.attributes || [])
        if (attr.type === "JSXAttribute" && attr.name?.name === attrName) return attr.value;
    return null;
}

/** The `x.set(HEADER, …)` call a proxy stamps with, if there is exactly one. */
function stampingCall(fn) {
    const sets = memberCalls(fn, "set");
    return sets.length === 1 ? sets[0] : null;
}

export function run({ check, assert, log }) {
    // ── 1: the predicate, by behavior ───────────────────────────────────────
    log("a destination is an address within this app, and nothing else:");

    const accepted = [
        ["a scanned tool item", "/tool-items/HYE-TL-260909-004", "/tool-items/HYE-TL-260909-004"],
        ["a narrowed list, query and all", "/prs?job=rec1&mine=1", "/prs?job=rec1&mine=1"],
        ["a fragment is dropped", "/materials#row", "/materials"],
        ["dot segments collapse", "/a/../../b", "/b"],
    ];
    for (const [why, input, want] of accepted) check(`${why}: ${input}`, safeDestination(input), want);

    const refused = [
        ["an absolute URL", "https://evil.example"],
        ["a protocol-relative one", "//evil.example"],
        ["a backslash a browser reads as a host", "/\\evil.example"],
        ["a scheme that is not http", "javascript:alert(1)"],
        ["a bare word", "tool-items"],
        ["the sign-in screen itself", SIGN_IN_PATH],
        ["the confirmation under it", `${CONFIRM_PATH}?token=x`],
        ["an endpoint", "/api/files/quotation/HYE-PR-260909-01/q.pdf"],
        ["a newline smuggled in", "/prs\nSet-Cookie: x=1"],
        ["nothing at all", ""],
    ];
    for (const [why, input] of refused) check(`${why}: ${JSON.stringify(input)}`, safeDestination(input), null);
    for (const [why, input] of [
        ["null", null],
        ["undefined", undefined],
        ["an object", {}],
    ])
        check(`  and ${why} is not a string`, safeDestination(input), null);

    // A REFUSED DESTINATION AND NO DESTINATION ARE ONE OUTCOME, which is the rule
    // the sign-in screen renders no sentence for.
    check("a refused destination builds the bare sign-in path", signInPath("https://evil.example"), SIGN_IN_PATH);
    check("  as does none at all", signInPath(undefined), SIGN_IN_PATH);
    assert(
        "an accepted one is carried, encoded",
        signInPath("/tool-items/HYE-TL-260909-004") ===
            `${SIGN_IN_PATH}?${DESTINATION_PARAM}=%2Ftool-items%2FHYE-TL-260909-004`
    );
    assert(
        "the confirmation carries the token and the destination",
        confirmPath({ token: "abc", destination: "/tool-items/X" }) ===
            `${CONFIRM_PATH}?token=abc&${DESTINATION_PARAM}=%2Ftool-items%2FX`
    );
    check("  a refusal with no token keeps it", confirmPath({ destination: "/prs" }), `${CONFIRM_PATH}?${DESTINATION_PARAM}=%2Fprs`);
    check("  and a bare confirmation stays bare", confirmPath({}), CONFIRM_PATH);
    assert("the fallback is the root screen", DEFAULT_DESTINATION === "/");

    // ── 2: the address is stamped onto the request ──────────────────────────
    log("");
    log("`proxy.js` stamps the address and nothing else touches it:");

    const proxy = parseFile("proxy.js");
    const proxyOwned = importedFrom(proxy.ast, OWNER);
    assert(`proxy.js imports the header's name from ${OWNER}`, proxyOwned.has("REQUEST_PATH_HEADER"));

    const proxyFn = resolveFunction(proxy.ast, "proxy");
    assert("it exports a proxy function", Boolean(proxyFn));
    const stamp = stampingCall(proxyFn);
    assert("which sets exactly one header", Boolean(stamp));
    assert(
        "  keyed by the imported identifier rather than a literal of its own",
        stamp?.arguments[0]?.type === "Identifier" && proxyOwned.has(stamp.arguments[0].name)
    );
    // The VALUE has to be the address the request was made to. Asserted as the
    // two properties it is built from, because a template of them is the only
    // shape that can be read without running it.
    const stampedFrom = new Set();
    walk(stamp?.arguments[1] ?? {}, (n) => {
        if (n.type === "MemberExpression" && n.property?.type === "Identifier") stampedFrom.add(n.property.name);
    });
    assert("  and valued from nextUrl's own path", stampedFrom.has("nextUrl") && stampedFrom.has("pathname"));
    assert("  with the query, so a narrowed list comes back narrowed", stampedFrom.has("search"));
    // It has to reach the app as a REQUEST header, which is one specific shape.
    const passes = callsTo(proxyFn, "next").some((call) =>
        call.arguments[0]?.properties?.some((p) => p.key?.name === "request")
    );
    assert("  handed on through NextResponse.next({ request })", passes);

    // ── 3: THIS IS NOT A GATE ───────────────────────────────────────────────
    // #46 refused a proxy deliberately and left a revisit condition behind it, so
    // the file existing at all is the invitation this section answers. The
    // paragraphs in its header are the argument; these are what make them hold.
    log("");
    log("and it decides nothing — authorization stays in the page:");
    const proxyNames = new Set();
    walk(proxy.ast, (n) => {
        if (n.type === "Identifier") proxyNames.add(n.name);
    });
    const gatesNamed = GATE_NAMES.filter((name) => proxyNames.has(name));
    check(
        `no authorization helper is named in it${gatesNamed.length ? ` (${gatesNamed.join(", ")})` : ""}`,
        gatesNamed.length,
        0
    );
    const proxyImports = importSources(proxy.ast);
    const credentialed = proxyImports.filter((src) => src.includes("airtable") || src.includes("session"));
    check(
        `it imports nothing that could read a record or a session${credentialed.length ? ` (${credentialed.join(", ")})` : ""}`,
        credentialed.length,
        0
    );
    assert("  which leaves two imports", proxyImports.length === 2);

    // THE MATCHER'S GROUND, HELD FROM THE OTHER SIDE. `/api` is excluded because
    // a Route Handler cannot call `requireUser()` at all, so the day one does,
    // this fails rather than the exclusion quietly becoming wrong.
    const { entries } = listEntryPoints();
    const handlerFiles = [...new Set(entries.filter((e) => isRouteFile(e.file)).map((e) => e.file))];
    assert(`${handlerFiles.length} Route Handlers are enumerated`, handlerFiles.length > 5);
    const handlersGating = handlerFiles.filter((rel) => callsTo(parseFile(rel).ast, "requireUser").length > 0);
    check(
        `none of them calls requireUser${handlersGating.length ? ` (${handlersGating.join(", ")})` : ""}`,
        handlersGating.length,
        0
    );
    const matcher = String(proxy.ast.body.map((n) => JSON.stringify(n)).join("")).includes("matcher");
    assert("the proxy declares a matcher", matcher);
    const matcherText = [];
    walk(proxy.ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("(?!")) matcherText.push(n.value);
    });
    assert("  which excludes the endpoints", matcherText.some((m) => m.includes("api/")));
    assert("  and the framework's own assets", matcherText.some((m) => m.includes("_next/")));

    // ── 4: requireUser carries it into the sign-in screen ───────────────────
    log("");
    log("`requireUser()` hands the address to the sign-in screen:");
    const authz = parseFile("lib/authz.js");
    const authzOwned = importedFrom(authz.ast, OWNER);
    const requireUser = resolveFunction(authz.ast, "requireUser");
    assert("requireUser resolves", Boolean(requireUser));

    const reads = memberCalls(requireUser, "get").filter(
        (call) => call.arguments[0]?.type === "Identifier" && authzOwned.has(call.arguments[0].name)
    );
    check("it reads the header by the imported identifier", reads.length, 1);

    const redirects = callsTo(requireUser, "redirect");
    check("and redirects exactly once", redirects.length, 1);
    const target = redirects[0]?.arguments[0];
    assert(
        "  to a path the destination builder made",
        target?.type === "CallExpression" && target.callee?.name === "signInPath" && authzOwned.has("signInPath")
    );
    // Optional all the way down: a mutant that redirects to a literal has no
    // arguments to read, and a crash is a worse failure than a reported one —
    // measured, on the mutation that put `redirect("/login")` back.
    assert(
        "  built from the header it just read",
        reaches(requireUser, target?.arguments?.[0], "get")
    );

    // ── 5: the endpoint that turns a destination into a redirect ────────────
    log("");
    log("`POST /api/auth/verify` judges before it redirects:");
    const verify = parseFile("app/api/auth/verify/route.js");
    const verifyOwned = importedFrom(verify.ast, OWNER);
    const post = resolveFunction(verify.ast, "POST");
    assert("the POST resolves", Boolean(post));

    const judged = callsTo(post, "safeDestination").filter((call) =>
        memberCalls(call, "get").some(
            (get) => get.arguments[0]?.type === "Identifier" && verifyOwned.has(get.arguments[0].name)
        )
    );
    check("the submitted field is judged, by its declared name", judged.length, 1);

    const seeOthers = callsTo(post, "seeOther");
    assert(`every response is one of ${seeOthers.length} redirects`, seeOthers.length >= 3);
    assert(
        "  and `seeOther` is the only thing that redirects",
        callsTo(post, "redirect").length === 1 &&
            callsTo(localInit(post, "seeOther") ?? {}, "redirect").length === 1
    );
    const unjudged = seeOthers.filter((call) => {
        const arg = call.arguments[0];
        const built = arg?.type === "CallExpression" && arg.callee?.name === "confirmPath";
        return !built && !reaches(post, arg, "safeDestination");
    });
    check(
        `every redirect is built by confirmPath or is the judged destination${unjudged.length ? ` (${unjudged.length} not)` : ""}`,
        unjudged.length,
        0
    );

    // ── 6: the hop that leaves the app ──────────────────────────────────────
    // `lib/email.js` cannot be IMPORTED here — it throws at module load without
    // `RESEND_API_KEY` — but it can be parsed, and one thing about it is this
    // issue's: the link gained a second parameter, so the `&` joining them is an
    // entity start inside an `href` this file writes by hand.
    log("");
    log("the mail's link is built by the same builder, and escaped into its href:");
    const auth = parseFile("lib/auth.js");
    assert("lib/auth.js builds the mail's URL with confirmPath", callsTo(auth.ast, "confirmPath").length === 1);
    const mail = parseFile("lib/email.js");
    const magicLink = resolveFunction(mail.ast, "sendMagicLinkEmail");
    assert("sendMagicLinkEmail resolves", Boolean(magicLink));
    const hrefs = [];
    walk(magicLink, (n) => {
        if (n.type !== "TemplateLiteral") return;
        n.quasis.forEach((quasi, i) => {
            if ((quasi.value.cooked ?? "").includes('href="')) hrefs.push(n.expressions[i]);
        });
    });
    check("it writes one href", hrefs.length, 1);
    assert(
        "  whose value goes through the escaper rather than in raw",
        hrefs[0]?.type === "CallExpression" && hrefs[0].callee?.name === "htmlAttr"
    );

    // ── 7: the two screens that hold it in between ──────────────────────────
    log("");
    log("both sign-in screens judge it before they render it:");
    for (const rel of ["app/login/page.js", "app/login/confirm/page.js"]) {
        const page = parseFile(rel);
        assert(`${rel} imports the predicate`, importedFrom(page.ast, OWNER).has("safeDestination"));
        assert("  and calls it", callsTo(page.ast, "safeDestination").length > 0);
    }

    // The sign-in screen hands the form a judged value, which is what makes the
    // form's own ignorance of the parameter safe.
    const loginPage = parseFile("app/login/page.js");
    const forms = jsxElements(loginPage.ast, "LoginForm");
    check("the sign-in screen renders one form", forms.length, 1);
    assert(
        "  whose destination traces back to the predicate",
        reaches(loginPage.ast, attrValue(forms[0], "destination"), "safeDestination")
    );

    // The hidden field is what crosses from the confirmation to the endpoint: it
    // has to be named by the same constant the endpoint reads, and valued from
    // the judged local rather than from what the URL said.
    const confirm = parseFile("app/login/confirm/page.js");
    const owned = importedFrom(confirm.ast, OWNER);
    const carriers = jsxElements(confirm.ast, "input").filter((el) => {
        const named = attrValue(el, "name");
        return (
            named?.type === "JSXExpressionContainer" &&
            named.expression?.type === "Identifier" &&
            owned.has(named.expression.name)
        );
    });
    check("the confirmation carries it in one hidden field", carriers.length, 1);
    assert(
        "  valued from the judged local",
        reaches(confirm.ast, attrValue(carriers[0], "value"), "safeDestination")
    );
    // And the way back keeps it, so an expired link does not cost the destination.
    assert(
        "  and `Request a new sign-in link` keeps it",
        jsxElements(confirm.ast, "Link").some((el) => reaches(confirm.ast, attrValue(el, "href"), "signInPath"))
    );

    // ── 7: the detectors, seen finding what they look for ───────────────────
    // ANTI-VACUITY. Every zero above is also what a walk that visits nothing
    // reports, so each detector is shown a planted violation written out here
    // rather than committed to a file.
    log("");
    log("and the detectors are seen finding a planted defect:");

    const literalHeader = parseSource(
        'import { NextResponse } from "next/server";\n' +
            "export function proxy(request) {\n" +
            "  const headers = new Headers(request.headers);\n" +
            '  headers.set("x-request-path", request.nextUrl.pathname);\n' +
            "  return NextResponse.next({ request: { headers } });\n" +
            "}\n",
        "<literal-header>"
    );
    const plantedStamp = stampingCall(resolveFunction(literalHeader.ast, "proxy"));
    assert(
        "a proxy stamping a literal of its own is reported",
        plantedStamp?.arguments[0]?.type === "Literal" &&
            !importedFrom(literalHeader.ast, OWNER).has("REQUEST_PATH_HEADER")
    );
    assert(
        "  and one that drops the query is reported",
        !new Set(
            (() => {
                const seen = [];
                walk(plantedStamp?.arguments[1] ?? {}, (n) => {
                    if (n.type === "MemberExpression" && n.property?.type === "Identifier") seen.push(n.property.name);
                });
                return seen;
            })()
        ).has("search")
    );

    const bareRedirect = parseSource(
        "export async function requireUser() {\n" +
            "  const user = await getActiveUser();\n" +
            '  if (!user) redirect("/login");\n' +
            "  return user;\n" +
            "}\n",
        "<bare-redirect>"
    );
    const bare = callsTo(resolveFunction(bareRedirect.ast, "requireUser"), "redirect")[0];
    assert(
        "a requireUser that drops the destination is reported",
        bare?.arguments[0]?.type === "Literal"
    );

    const rawValue = parseSource(
        "export async function POST(request) {\n" +
            "  const form = await request.formData();\n" +
            '  const destination = form.get("destination");\n' +
            "  const seeOther = (path) => NextResponse.redirect(new URL(path, request.url), 303);\n" +
            '  return seeOther(destination ?? "/");\n' +
            "}\n",
        "<raw-destination>"
    );
    const rawPost = resolveFunction(rawValue.ast, "POST");
    const rawArg = callsTo(rawPost, "seeOther")[0]?.arguments[0];
    assert(
        "a redirect to an unjudged form value is reported",
        Boolean(rawArg) && !reaches(rawPost, rawArg, "safeDestination")
    );
    // …and the same shape WITH the predicate is not, so the detector is reading
    // the binding rather than refusing every expression of that shape.
    const judgedValue = parseSource(
        "export async function POST(request) {\n" +
            "  const form = await request.formData();\n" +
            '  const destination = safeDestination(form.get("destination"));\n' +
            "  const seeOther = (path) => NextResponse.redirect(new URL(path, request.url), 303);\n" +
            '  return seeOther(destination ?? "/");\n' +
            "}\n",
        "<judged-destination>"
    );
    const goodPost = resolveFunction(judgedValue.ast, "POST");
    assert(
        "  while the judged one is not",
        reaches(goodPost, callsTo(goodPost, "seeOther")[0]?.arguments[0], "safeDestination")
    );

    const gatingProxy = parseSource(
        'import { requireUser } from "@/lib/authz";\n' + "export function proxy() { return requireUser(); }\n",
        "<gating-proxy>"
    );
    const gatingNames = new Set();
    walk(gatingProxy.ast, (n) => {
        if (n.type === "Identifier") gatingNames.add(n.name);
    });
    assert(
        "and a proxy reaching for a gate is reported",
        GATE_NAMES.some((name) => gatingNames.has(name))
    );
}

if (isMain(import.meta.url)) standalone(title, run);
