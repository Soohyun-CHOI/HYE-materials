// A code from the sign-in email signs in the screen that asked, and nothing else
// (#471).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. The code is a second way to spend a
// row the link already spends, so the one correctness property the issue has is
// that the two ways are ONE mechanism — one lock key, one write that ends the row
// — and not two that happen to agree today. The second property is that the code
// is worth nothing outside the browser that asked, which rests on a sealed binding
// that must never carry the token or the code itself. The third is that every
// sign-in POST refuses a submission from another site, since a code, like a token,
// authenticates a request and not the person who sent it.
//
//   ALL THREE ARE SHAPES, AND THEY ARE HELD ON THE AST. `lib/airtable/authTokens.js`,
//   `lib/auth.js` and `lib/session.js` cannot be imported here — each reaches a
//   credential or `next/headers` — so what they do is not callable in this tier; how
//   they are built is. `auth-token-state.mjs` pins what a code attempt is JUDGED to
//   be, which is pure; this pins that the credentialed modules are wired around that
//   judgment the way the issue needs.
//
// WHAT A PASS DOES NOT PROVE. That a link and a code arriving together end the row
// once — `withKeyLock` serializes within one process, and whether two real requests
// do is measured in `verify-token-and-lock-174.mjs`. That the count is written
// before an attempt is answered, which is an ordering inside one function and is
// read here only as the absence of any path that answers without writing. And that
// a browser really keeps the binding apart from another host's cookies, which is a
// browser's property and is in the pull request.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { isCrossOrigin } from "../../../lib/crossOrigin.js";
import { callsBefore, callsTo, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A code from the email signs in the screen that asked (#471)";

const TOKENS = "lib/airtable/authTokens.js";
const AUTH = "lib/auth.js";
const SESSION = "lib/session.js";

/** Every sign-in POST that binds a browser or spends a row, and what it reads. */
const SIGN_IN_ENDPOINTS = [
    { file: "app/api/auth/request/route.js", method: "POST", reads: "json" },
    { file: "app/api/auth/request/route.js", method: "DELETE", reads: null },
    { file: "app/api/auth/code/route.js", method: "POST", reads: "json" },
    { file: "app/api/auth/verify/route.js", method: "POST", reads: "formData" },
];

/** What spends a row. No page may name one. */
const CONSUMERS = ["consumeAuthToken", "consumeAuthCode", "verifyMagicLink", "signInWithCode"];

/** The names a module imports, from the AST rather than the text. */
function importedNames(ast) {
    const names = new Set();
    walk(ast, (n) => {
        if (n.type !== "ImportDeclaration") return;
        for (const s of n.specifiers ?? []) if (s.local?.name) names.add(s.imported?.name ?? s.local.name);
    });
    return names;
}

/** Every `Used: true` property in a subtree. */
function usedTrue(node) {
    const found = [];
    walk(node, (n) => {
        if (
            n.type === "Property" &&
            (n.key?.name === "Used" || n.key?.value === "Used") &&
            n.value?.type === "Literal" &&
            n.value.value === true
        )
            found.push(n);
    });
    return found;
}

/** The lock key a function's one `withKeyLock` call is built with, by builder name. */
function lockBuilder(fn) {
    const calls = callsTo(fn, "withKeyLock");
    if (calls.length !== 1) return null;
    const key = calls[0].arguments[0];
    return key?.type === "CallExpression" && key.callee?.type === "Identifier" ? key.callee.name : null;
}

/** The property names of the object literal handed to the first call to `callee`. */
function keysPassedTo(fn, callee) {
    const call = callsTo(fn, callee)[0];
    const arg = call?.arguments[0];
    if (arg?.type !== "ObjectExpression") return null;
    return arg.properties.map((p) => p.key?.name ?? p.key?.value).sort();
}

/** The property names every `NextResponse.json(...)` in a file answers with. */
function answeredKeys(ast) {
    const keys = new Set();
    walk(ast, (n) => {
        if (
            n.type === "CallExpression" &&
            n.callee?.type === "MemberExpression" &&
            n.callee.object?.name === "NextResponse" &&
            n.callee.property?.name === "json" &&
            n.arguments[0]?.type === "ObjectExpression"
        ) {
            for (const p of n.arguments[0].properties) keys.add(p.key?.name ?? p.key?.value);
        }
    });
    return keys;
}

export function run({ check, assert, log }) {
    // ── 1: the cross-origin predicate, by behavior ──────────────────────────
    log("a submission from another site is refused, and absence fails open:");
    const request = (headers) => ({ headers: { get: (name) => headers[name] ?? null } });
    check("no Origin at all", isCrossOrigin(request({ host: "portal.example.com" })), false);
    check("the same host", isCrossOrigin(request({ origin: "https://portal.example.com", host: "portal.example.com" })), false);
    check("another host", isCrossOrigin(request({ origin: "https://evil.example", host: "portal.example.com" })), true);
    check(
        "the same name on another port",
        isCrossOrigin(request({ origin: "http://localhost:4000", host: "localhost:3000" })),
        true
    );
    check("a malformed Origin", isCrossOrigin(request({ origin: "not a url", host: "portal.example.com" })), true);
    check("an opaque `null` Origin", isCrossOrigin(request({ origin: "null", host: "portal.example.com" })), true);

    // ── 2: every sign-in POST asks it, before it reads anything ─────────────
    log("");
    log("every endpoint that binds a browser or spends a row asks first:");
    for (const { file, method, reads } of SIGN_IN_ENDPOINTS) {
        const { ast } = parseFile(file);
        const fn = resolveFunction(ast, method);
        assert(`${method} ${file} resolves`, Boolean(fn));
        if (!fn) continue;
        assert("  and imports the predicate rather than keeping its own", importedNames(ast).has("isCrossOrigin"));
        check("  it asks once", callsTo(fn, "isCrossOrigin").length, 1);
        if (reads) assert(`  before reading its body (${reads})`, callsBefore(fn, "isCrossOrigin", reads));
    }
    const localCopies = [];
    for (const { file } of SIGN_IN_ENDPOINTS) {
        walk(parseFile(file).ast, (n) => {
            if (n.type === "FunctionDeclaration" && n.id?.name === "isCrossOrigin") localCopies.push(file);
        });
    }
    check("no route declares a copy of it", localCopies.join(", "), "");

    // ── 3: one lock and one write for both ways into a row ──────────────────
    log("");
    log("the link and the code take one lock and end the row with one write:");
    const tokens = parseFile(TOKENS);
    const consumeLink = resolveFunction(tokens.ast, "consumeAuthToken");
    const consumeCode = resolveFunction(tokens.ast, "consumeAuthCode");
    const spend = resolveFunction(tokens.ast, "spendAuthToken");
    assert("consumeAuthToken, consumeAuthCode and spendAuthToken resolve", Boolean(consumeLink && consumeCode && spend));
    check("the link's lock key comes from", lockBuilder(consumeLink), "rowLockKey");
    check("  and the code's from the same builder", lockBuilder(consumeCode), "rowLockKey");
    const builders = [];
    walk(tokens.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "rowLockKey") builders.push(n);
    });
    check("  which is declared once", builders.length, 1);
    check("`Used: true` is written in one place in the module", usedTrue(tokens.ast).length, 1);
    check("  and that place is the shared write", usedTrue(spend).length, 1);
    check("the link ends its row through it", callsTo(consumeLink, "spendAuthToken").length, 1);
    check("  and so does the code", callsTo(consumeCode, "spendAuthToken").length, 1);

    // ── 4: the code is made and compared the way the issue settled ──────────
    log("");
    log("the code is drawn at random and compared in constant time, never in a formula:");
    const create = resolveFunction(tokens.ast, "createAuthToken");
    const matches = resolveFunction(tokens.ast, "codesMatch");
    check("createAuthToken draws it with crypto.randomInt", callsTo(create, "randomInt").length, 1);
    check("codesMatch compares with timingSafeEqual", callsTo(matches, "timingSafeEqual").length, 1);
    check("consumeAuthCode compares only through codesMatch", callsTo(consumeCode, "codesMatch").length, 1);
    let formulas = 0;
    walk(consumeCode, (n) => {
        if (n.type === "Property" && n.key?.name === "filterByFormula") formulas += 1;
    });
    check("  builds no formula of its own", formulas, 0);
    check("  and never looks a row up by token", callsTo(consumeCode, "getAuthTokenRecord").length, 0);
    // A wrong code is answered only by a path that writes its count first.
    const codeWrites = callsTo(consumeCode, "update").length + callsTo(consumeCode, "spendAuthToken").length;
    check("an attempt that reached the comparison has two writes to choose from", codeWrites, 2);

    // ── 5: the binding carries neither credential ───────────────────────────
    log("");
    // #148 added the time the email was asked for, which `Resend email`'s wait counts from on
    // a page drawn again. The time says nothing a stranger could use; the token and the code
    // stay out, which is what the two `nothing else` assertions hold.
    log("the asking browser holds the row's id, the address and when it asked, and never the token or the code:");
    const auth = parseFile(AUTH);
    const requestLink = resolveFunction(auth.ast, "requestMagicLink");
    check(
        "requestMagicLink binds with",
        (keysPassedTo(requestLink, "writePendingSignIn") ?? []).join(","),
        "authTokenRecordId,email,requestedAt"
    );
    assert("  only once the email has gone", callsBefore(requestLink, "sendMagicLinkEmail", "writePendingSignIn"));
    const session = parseFile(SESSION);
    const writeBinding = resolveFunction(session.ast, "writePendingSignIn");
    const assigned = [];
    walk(writeBinding, (n) => {
        if (n.type === "AssignmentExpression" && n.left?.type === "MemberExpression") assigned.push(n.left.property?.name);
    });
    check("  and the binding writes those three and nothing else", assigned.sort().join(","), "authTokenRecordId,email,requestedAt");
    for (const file of ["app/api/auth/request/route.js", "app/api/auth/code/route.js"]) {
        const answered = answeredKeys(parseFile(file).ast);
        assert(`${file} answers (${[...answered].join(", ")})`, answered.size > 0);
        check("  with neither the token nor the code", [...answered].filter((k) => k === "token" || k === "code").join(","), "");
    }
    const signIn = resolveFunction(auth.ast, "signInWithCode");
    check("a code is tried against the binding's row", callsTo(signIn, "readPendingSignIn").length, 1);
    check("  and a code that signed in forgets it", callsTo(signIn, "clearPendingSignIn").length, 1);
    const verifyLink = resolveFunction(auth.ast, "verifyMagicLink");
    check("the link and the code start one session the same way", callsTo(verifyLink, "startSession").length + callsTo(signIn, "startSession").length, 2);

    // ── 6: the sign-in screen reads and never spends ────────────────────────
    log("");
    log("the sign-in screen names nothing that spends a row:");
    for (const file of ["app/login/page.js", "app/login/LoginForm.js"]) {
        const { ast } = parseFile(file);
        const named = CONSUMERS.filter((name) => importedNames(ast).has(name) || callsTo(ast, name).length > 0);
        check(`  ${file}`, named.join(", "), "");
    }
    // ANTI-VACUITY: the absence above is also what a wrong path reports, so the
    // read the page does make is asserted present.
    check("  while the page does read the binding", callsTo(parseFile("app/login/page.js").ast, "readPendingSignIn").length, 1);
    check("the code's route is what spends one", callsTo(parseFile("app/api/auth/code/route.js").ast, "signInWithCode").length, 1);

    // ── 7: the detectors, seen finding what they look for ───────────────────
    log("");
    log("and the detectors are seen finding a planted defect:");
    const unguarded = parseSource(
        "export async function POST(request) {\n  const body = await request.json();\n  return body;\n}\n",
        "<unguarded>"
    );
    check("a POST that never asks is reported", callsTo(resolveFunction(unguarded.ast, "POST"), "isCrossOrigin").length, 0);
    const late = parseSource(
        "export async function POST(request) {\n  const body = await request.json();\n  if (isCrossOrigin(request)) return null;\n  return body;\n}\n",
        "<late>"
    );
    assert("  and one that asks after reading is too", !callsBefore(resolveFunction(late.ast, "POST"), "isCrossOrigin", "json"));
    const twoKeys = parseSource(
        "const rowLockKey = (t) => `k:${t}`;\n" +
            "async function consumeAuthCode(id) { return withKeyLock(`code:${id}`, async () => null); }\n",
        "<two-keys>"
    );
    check("a code path locking on its own key is reported", lockBuilder(resolveFunction(twoKeys.ast, "consumeAuthCode")), null);
    const leaky = parseSource(
        "async function requestMagicLink(email) {\n  await writePendingSignIn({ authTokenRecordId: id, email, token });\n}\n",
        "<leaky-binding>"
    );
    assert(
        "a binding that carries the token is reported",
        (keysPassedTo(resolveFunction(leaky.ast, "requestMagicLink"), "writePendingSignIn") ?? []).join(",") !==
            "authTokenRecordId,email,requestedAt"
    );
    const secondSpend = parseSource(
        "async function a(r) { await base(T).update([{ id: r.id, fields: { Used: true } }]); }\n" +
            "async function b(r) { await base(T).update([{ id: r.id, fields: { Used: true } }]); }\n",
        "<second-spend>"
    );
    check("and a second write of `Used: true` is counted", usedTrue(secondSpend.ast).length, 2);
}

if (isMain(import.meta.url)) standalone(title, run);
