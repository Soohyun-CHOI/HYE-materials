// An account that is off is told so on the sign-in screen, and only once its address is
// proven (#491).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. A person whose `Users` row the office has turned
// off used to finish signing in and be sent back to the sign-in screen with nothing said, and
// one turned off while signed in was sent there the same way from the next page. Now both land
// on the screen's deactivated step — and the one property that makes saying so safe is WHO can
// be made to see it: only a browser that spent the email's link, typed its code, or holds the
// session the address signed in. So this holds where the sentence is decided, what carries it to
// the screen, and that nothing before the proof — the email step, a URL — can produce it.
//
//   THE PURE HALF IS CALLED. `lib/accountStatus.js` judges a row and seals and opens the
//   finding a page hands to the ending route, and it runs under plain `node`: an `Inactive`
//   row, a blank one, a forged seal, an altered one, an expired one and a session's own seal
//   are each handed to it. The words are pinned by value, from the design's 1m.
//
//   THE CREDENTIALED HALF IS READ ON THE AST. `lib/auth.js`, `lib/authz.js`, `lib/session.js`
//   and the routes reach a credential or `next/*`, so how they are wired is what this tier can
//   hold: the sign-in decides before it makes a session, the gate ends a session whose row is
//   off before it redirects, the route compares the seal with the session before it writes, the
//   screen reads the notice from its cookie and from nothing else, and the email step asks
//   nothing about the row. Each detector is then shown a planted defect it has to report.
//
// WHAT A PASS DOES NOT PROVE. That a browser lands on the step: a page's redirect, Next's way of
// following an action's redirect on the server, and a cookie a 303 sets are a browser's and a
// framework's, walked in the pull request with an account turned off on the test base. That the
// office's edit takes effect on the next page rather than at some later read is the gate's one
// read per request, which this tier never makes.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { existsSync, readFileSync } from "node:fs";
import { sealData } from "iron-session";
import {
    DEACTIVATED_PATH,
    deactivatedPath,
    HANDOFF_PARAM,
    HANDOFF_SECONDS,
    isActiveAccount,
    openDeactivatedHandoff,
    sealDeactivatedHandoff,
} from "../../../lib/accountStatus.js";
import { SIGN_IN_COPY } from "../../../lib/authTokenState.js";
import { callsBefore, callsTo, parseFile, parseSource, repoPath, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An account that is off is told so on the sign-in screen, once its address is proven (#491)";

/** A throwaway secret of the length iron-session demands. Seals made with it are discarded. */
const PASSWORD = "offline-deactivated-account-check-00000";
const OTHER_PASSWORD = "offline-deactivated-account-check-11111";

const AUTH = "lib/auth.js";
const AUTHZ = "lib/authz.js";
const SESSION = "lib/session.js";
const ROUTE = "app/api/auth/deactivated/route.js";

// ---------------------------------------------------------------------------
// reading the source
// ---------------------------------------------------------------------------

/** The initializer of a local `const name = …` inside a subtree, or null. */
function localInit(node, name) {
    let init = null;
    walk(node, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.id.name === name && n.init) init = n.init;
    });
    return init;
}

const unwrapAwait = (node) => (node?.type === "AwaitExpression" ? node.argument : node);

/** Every `if` whose test is `!name(…)`. */
function ifNot(fn, name) {
    const found = [];
    walk(fn, (n) => {
        if (n.type !== "IfStatement") return;
        const t = n.test;
        if (t?.type === "UnaryExpression" && t.operator === "!" && t.argument?.type === "CallExpression" && t.argument.callee?.name === name)
            found.push(n);
    });
    return found;
}

/** Every `if` whose test reads `.property` off something. */
function ifReads(fn, property) {
    const found = [];
    walk(fn, (n) => {
        if (n.type !== "IfStatement") return;
        let reads = false;
        walk(n.test, (m) => {
            if (m.type === "MemberExpression" && m.property?.name === property) reads = true;
        });
        if (reads) found.push(n);
    });
    return found;
}

/** Does this subtree return? */
function returns(node) {
    let found = false;
    walk(node, (n) => {
        if (n.type === "ReturnStatement") found = true;
    });
    return found;
}

/** The names a module imports from a path ending in `suffix`. */
function importedFrom(ast, suffix) {
    const names = new Set();
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && String(n.source.value).endsWith(suffix))
            for (const s of n.specifiers ?? []) names.add(s.imported?.name ?? s.local?.name);
    });
    return names;
}

/** The value of a module-level `const name = "…"`, or null. */
function moduleString(ast, name) {
    for (const node of ast.body) {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
        if (decl?.type !== "VariableDeclaration") continue;
        for (const d of decl.declarations)
            if (d.id?.name === name && d.init?.type === "Literal" && typeof d.init.value === "string") return d.init.value;
    }
    return null;
}

/** The names a module exports. */
function exportedNames(ast) {
    const names = new Set();
    for (const node of ast.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        const decl = node.declaration;
        if (decl?.id?.name) names.add(decl.id.name);
        for (const d of decl?.declarations ?? []) if (d.id?.name) names.add(d.id.name);
        for (const s of node.specifiers ?? []) names.add(s.exported?.name);
    }
    return names;
}

// ---------------------------------------------------------------------------
// the detectors, each called on the real source and on a planted defect
// ---------------------------------------------------------------------------

/**
 * A sign-in that decides before it makes a session: the row is judged before `createSession`,
 * and the branch for a row that is off ends the browser's session, says so, returns, and makes
 * none.
 */
function signInDecides(fn) {
    const branch = ifNot(fn, "isActiveAccount")[0];
    return {
        judgedFirst: callsBefore(fn, "isActiveAccount", "createSession"),
        branchEnds: Boolean(branch) && callsTo(branch.consequent, "endDeactivatedSession").length === 1,
        branchReturns: Boolean(branch) && returns(branch.consequent),
        branchMakesNone: Boolean(branch) && callsTo(branch.consequent, "createSession").length === 0,
    };
}

/** What the email step asks about a row before any address is proven: nothing, or these. */
const BEFORE_PROOF = ["getUserByEmail", "getUserByRecordId", "isActiveAccount", "endDeactivatedSession", "readDeactivatedNotice"];
const asksBeforeProof = (fn) => BEFORE_PROOF.filter((name) => callsTo(fn, name).length > 0);

/** A gate that ends a session whose row is off before it sends the reader to sign in. */
function gateEnds(fn) {
    const branch = ifNot(fn, "isActiveAccount")[0];
    const ending = branch ? callsTo(branch.consequent, "endDeactivatedSessionHere")[0] : null;
    const signIn = branch ? callsTo(branch.consequent, "signInPath")[0] : null;
    return {
        reads: callsTo(fn, "readSessionUser").length === 1,
        ends: Boolean(ending),
        beforeSignIn: Boolean(ending && signIn && ending.start < signIn.start),
    };
}

/**
 * The route's half: the seal is opened, and the session compared with it, before anything is
 * written — a comparison of `.userId` whose `if` returns, standing between the opening and the
 * ending.
 */
function comparesBeforeEnding(fn) {
    const opened = callsTo(fn, "openDeactivatedHandoff")[0];
    const ending = callsTo(fn, "endDeactivatedSession")[0];
    const compare = ifReads(fn, "userId").find((n) => n.test?.type === "BinaryExpression" && returns(n.consequent));
    return Boolean(opened && ending && compare && opened.start < compare.start && compare.start < ending.start);
}

/** Where the screen's `deactivated` comes from: true only for the notice's own reader. */
function noticeFromCookie(fn) {
    let attr = null;
    walk(fn, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "LoginForm")
            attr = n.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "deactivated") ?? null;
    });
    const value = attr?.value?.expression;
    if (value?.type !== "Identifier") return false;
    const init = unwrapAwait(localInit(fn, value.name));
    return init?.type === "CallExpression" && init.callee?.name === "readDeactivatedNotice";
}

/**
 * Whether the form's opening step asks about the notice FIRST: some `useState` opens on a
 * ternary whose outermost test is `deactivated` and whose answer is the step. A nested one —
 * the code step's test first, then the notice's — is the order this rules out. The form is
 * the file's default export, which `resolveFunction` does not follow, so the file is walked.
 */
function opensOnTheStepFirst(ast) {
    let found = false;
    walk(ast, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "useState") return;
        const opening = n.arguments[0];
        if (opening?.type === "ConditionalExpression" && opening.test?.name === "deactivated" && opening.consequent?.value === "deactivated")
            found = true;
    });
    return found;
}

export async function run({ check, assert, log }) {
    // ── 1: the judgment ─────────────────────────────────────────────────────
    log("which rows may hold a session:");
    check("an Active row", isActiveAccount({ status: "Active" }), true);
    check("an Inactive row", isActiveAccount({ status: "Inactive" }), false);
    check("a row with no Status", isActiveAccount({ status: undefined }), false);
    check("a row whose Status is another case", isActiveAccount({ status: "active" }), false);
    check("no row at all", isActiveAccount(null), false);

    // ── 2: the words (Sign in 1m) ───────────────────────────────────────────
    log("");
    log("what the step says, by value:");
    check("its heading", SIGN_IN_COPY.deactivated.heading, "Your account has been deactivated");
    check("the sentence under it", SIGN_IN_COPY.deactivated.sentence, "Contact the office to reactivate it.");
    check("its one way on", SIGN_IN_COPY.deactivated.action, "Use a different email");

    // ── 3: the seal a page hands the route ──────────────────────────────────
    log("");
    log("the finding a page hands the ending route opens for this server, now, and for nothing else:");
    check("it is good for a minute", HANDOFF_SECONDS, 60);
    const seal = await sealDeactivatedHandoff("recOFFLINE491A", PASSWORD);
    check("a seal opens to the user it names", await openDeactivatedHandoff(seal, PASSWORD), "recOFFLINE491A");
    check("  not under another secret", await openDeactivatedHandoff(seal, OTHER_PASSWORD), null);
    const middle = Math.floor(seal.length / 2);
    const altered = seal.slice(0, middle) + (seal[middle] === "A" ? "B" : "A") + seal.slice(middle + 1);
    check("  not once altered", await openDeactivatedHandoff(altered, PASSWORD), null);
    const sessionSeal = await sealData({ userId: "recOFFLINE491A" }, { password: PASSWORD });
    check("  and a session's own seal, under the same secret, is no finding", await openDeactivatedHandoff(sessionSeal, PASSWORD), null);
    const realNow = Date.now;
    let stale;
    try {
        // Made three minutes ago: past the minute and iron's minute of clock skew.
        Date.now = () => realNow() - 3 * 60 * 1000;
        stale = await sealDeactivatedHandoff("recOFFLINE491A", PASSWORD);
    } finally {
        Date.now = realNow;
    }
    check("  nor one made three minutes ago", await openDeactivatedHandoff(stale, PASSWORD), null);
    check("  nor no value", await openDeactivatedHandoff(null, PASSWORD), null);
    check("the route's address", DEACTIVATED_PATH, "/api/auth/deactivated");
    check("  and the parameter the seal rides in", HANDOFF_PARAM, "handoff");
    const path = deactivatedPath(seal);
    const carried = new URL(path, "https://probe.invalid").searchParams.get("handoff");
    check("  a built address carries the seal whole", carried === seal, true);
    assert("  and the address is a route that answers GET", existsSync(repoPath(ROUTE)) && Boolean(resolveFunction(parseFile(ROUTE).ast, "GET")));

    // ── 4: the sign-in decides, and the email step asks nothing ──────────────
    log("");
    log("a sign-in judges the row it found before it makes a session:");
    const auth = parseFile(AUTH);
    const startSession = resolveFunction(auth.ast, "startSession");
    const decides = signInDecides(startSession);
    assert("startSession judges the row before createSession", decides.judgedFirst);
    assert("  its branch for a row that is off ends the browser's session and leaves the notice", decides.branchEnds);
    assert("  returns", decides.branchReturns);
    assert("  and makes no session", decides.branchMakesNone);
    check("  and a sign-in that works forgets an earlier notice", callsTo(startSession, "clearDeactivatedNotice").length, 1);
    check(
        "  the branch's answer says so, as `deactivated`",
        (() => {
            const branch = ifNot(startSession, "isActiveAccount")[0];
            let said = false;
            walk(branch?.consequent ?? {}, (n) => {
                if (n.type === "Property" && n.key?.name === "deactivated" && n.value?.value === true) said = true;
            });
            return said;
        })(),
        true
    );
    const request = resolveFunction(auth.ast, "requestMagicLink");
    check("the email step asks nothing about the row or the notice", asksBeforeProof(request).join(", "), "");

    log("");
    log("both ways in send a row that is off to the sign-in screen:");
    const verify = parseFile("app/api/auth/verify/route.js");
    const verifyPost = resolveFunction(verify.ast, "POST");
    const verifyOff = ifReads(verifyPost, "deactivated")[0];
    assert(
        "the link's POST, on `deactivated`, redirects to the sign-in screen",
        Boolean(verifyOff) &&
            callsTo(verifyOff.consequent, "seeOther").some((c) => c.arguments[0]?.name === "SIGN_IN_PATH") &&
            importedFrom(verify.ast, "loginDestination").has("SIGN_IN_PATH")
    );
    const code = parseFile("app/api/auth/code/route.js");
    const codePost = resolveFunction(code.ast, "POST");
    const codeOff = ifReads(codePost, "deactivated")[0];
    let handsSignIn = false;
    walk(codeOff?.consequent ?? {}, (n) => {
        if (n.type === "Property" && n.key?.name === "destination" && n.value?.name === "SIGN_IN_PATH") handsSignIn = true;
    });
    assert("the code's POST, on `deactivated`, hands the screen the sign-in screen", handsSignIn && importedFrom(code.ast, "loginDestination").has("SIGN_IN_PATH"));

    // ── 5: the gate ends a session whose row is off ─────────────────────────
    log("");
    log("the gate ends a session whose row is off, and sends nobody else anywhere new:");
    const authz = parseFile(AUTHZ);
    const requireUser = resolveFunction(authz.ast, "requireUser");
    const gate = gateEnds(requireUser);
    assert("requireUser reads the session's row, active or not", gate.reads);
    assert("  ends the session of a row that is off", gate.ends);
    assert("  before it sends the reader to sign in", gate.beforeSignIn);
    for (const name of ["getActiveUser", "takePageUser"])
        check(`  ${name} hands back only a row that may hold a session`, callsTo(resolveFunction(authz.ast, name), "isActiveAccount").length, 1);
    let statusReads = 0;
    for (const rel of [AUTH, AUTHZ])
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "MemberExpression" && n.property?.name === "status") statusReads++;
        });
    check("  and neither lib/auth.js nor lib/authz.js reads `.status` itself", statusReads, 0);

    const here = resolveFunction(authz.ast, "endDeactivatedSessionHere");
    const headerName = moduleString(authz.ast, "SERVER_ACTION_HEADER");
    check("an action is told by the header", headerName, "next-action");
    const nextHeaders = readFileSync(repoPath("node_modules/next/dist/client/components/app-router-headers.js"), "utf8");
    check("  which is Next's own ACTION_HEADER", (nextHeaders.match(/const ACTION_HEADER = '([^']+)'/) ?? [])[1], headerName);
    const actionBranch = ifReads(here, "has")[0] ?? null;
    let asksHeader = false;
    walk(here ?? {}, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "has" && n.arguments[0]?.name === "SERVER_ACTION_HEADER") asksHeader = true;
    });
    assert("  an action ends the session where it is, and lands on the sign-in screen", asksHeader && Boolean(actionBranch) &&
        callsBefore(actionBranch.consequent, "endDeactivatedSession", "redirect") &&
        callsTo(actionBranch.consequent, "redirect").some((c) => c.arguments[0]?.name === "SIGN_IN_PATH"));
    const handoffRedirect = callsTo(here, "redirect").find((c) => {
        const arg = unwrapAwait(c.arguments[0]);
        return arg?.type === "CallExpression" && arg.callee?.name === "deactivatedHandoffPath";
    });
    assert("  and a page hands it to the route, sealed", Boolean(handoffRedirect));

    // ── 6: the route acts only on the session the seal names ────────────────
    log("");
    log("the ending route compares the seal with the session before it writes:");
    const session = parseFile(SESSION);
    assert("endHandedOffSession opens the seal, compares, then ends", comparesBeforeEnding(resolveFunction(session.ast, "endHandedOffSession")));
    const ending = resolveFunction(session.ast, "endDeactivatedSession");
    check("  ending destroys the session", callsTo(ending, "destroy").length, 1);
    check("  and leaves the notice", callsTo(ending, "writeDeactivatedNotice").length, 1);
    const writers = [];
    walk(session.ast, (n) => {
        if (n.type === "FunctionDeclaration" && callsTo(n, "writeDeactivatedNotice").length > 0) writers.push(n.id.name);
    });
    check("  which nothing else in lib/session.js writes", writers.join(","), "endDeactivatedSession");
    assert("  and nothing outside it can", !exportedNames(session.ast).has("writeDeactivatedNotice"));
    const route = parseFile(ROUTE);
    const get = resolveFunction(route.ast, "GET");
    const handed = callsTo(get, "endHandedOffSession")[0];
    let readsParam = false;
    walk(handed ?? {}, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "get" && n.arguments[0]?.name === "HANDOFF_PARAM") readsParam = true;
    });
    assert("the route hands it the parameter the seal rides in", readsParam && importedFrom(route.ast, "accountStatus").has("HANDOFF_PARAM"));
    let lands = false;
    walk(get, (n) => {
        if (n.type === "Property" && n.key?.name === "Location" && n.value?.name === "SIGN_IN_PATH") lands = true;
    });
    assert("  and lands on the sign-in screen, on the host it was asked on", lands);

    // ── 7: the screen reads the notice, and only from its cookie ────────────
    log("");
    log("the sign-in screen draws the step from the notice and from nothing a URL says:");
    const page = parseFile("app/login/page.js");
    assert("/login hands the form the notice its cookie holds", noticeFromCookie(resolveFunction(page.ast, "renderLoginPage")));
    const readers = [];
    for (const rel of ["app/login/page.js", "app/login/LoginForm.js", "app/login/layout.js", "app/login/confirm/page.js", AUTH, AUTHZ])
        if (callsTo(parseFile(rel).ast, "readDeactivatedNotice").length > 0) readers.push(rel);
    check("  which nothing else reads", readers.join(","), "app/login/page.js");
    assert("  the form opens on the step ahead of the code step", opensOnTheStepFirst(parseFile("app/login/LoginForm.js").ast));
    const forget = resolveFunction(parseFile("app/api/auth/request/route.js").ast, "DELETE");
    assert(
        "  and its one way on forgets the notice with the binding",
        callsTo(forget, "clearDeactivatedNotice").length === 1 && callsTo(forget, "clearPendingSignIn").length === 1
    );

    // ── 8: the detectors, seen finding what they look for ───────────────────
    log("");
    log("and each detector is seen reporting a planted defect:");
    const fn = (source, name) => resolveFunction(parseSource(source, `<planted-${name}>`).ast, name);
    const lateJudge = signInDecides(
        fn(
            "async function startSession(email) {\n  const user = await getUserByEmail(email);\n  await createSession(user.id);\n" +
                "  if (!isActiveAccount(user)) { await endDeactivatedSession(); return { deactivated: true }; }\n}\n",
            "startSession"
        )
    );
    assert("a sign-in that makes the session before it judges is reported", !lateJudge.judgedFirst);
    const leaky = signInDecides(
        fn(
            "async function startSession(email) {\n  const user = await getUserByEmail(email);\n" +
                "  if (!isActiveAccount(user)) { await createSession(user.id); }\n  await createSession(user.id);\n}\n",
            "startSession"
        )
    );
    assert("  and so is a branch that makes one anyway and says nothing", !leaky.branchMakesNone && !leaky.branchEnds);
    check(
        "an email step that reads the row is reported",
        asksBeforeProof(fn("async function requestMagicLink(email) {\n  const user = await getUserByEmail(email);\n  if (!isActiveAccount(user)) return;\n}\n", "requestMagicLink")).join(", "),
        "getUserByEmail, isActiveAccount"
    );
    const silentGate = gateEnds(
        fn(
            "async function requireUser() {\n  const user = await readSessionUser();\n" +
                "  if (!isActiveAccount(user)) { redirect(signInPath(here)); }\n  return user;\n}\n",
            "requireUser"
        )
    );
    assert("a gate that sends a row that is off to sign in without ending it is reported", !silentGate.ends);
    assert(
        "a route that ends whatever session is there is reported",
        !comparesBeforeEnding(
            fn(
                "async function endHandedOffSession(handoff) {\n  const userId = await openDeactivatedHandoff(handoff, s);\n" +
                    "  if (!userId) return;\n  await endDeactivatedSession();\n}\n",
                "endHandedOffSession"
            )
        )
    );
    assert(
        "a form that asks about the code step before the notice is reported",
        !opensOnTheStepFirst(
            parseSource(
                'function LoginForm({ deactivated, pendingEmail }) {\n  const [step] = useState(pendingEmail ? "code" : deactivated ? "deactivated" : "email");\n}\n',
                "<planted-form>"
            ).ast
        )
    );
    assert(
        "a screen that reads the step off the URL is reported",
        !noticeFromCookie(
            fn(
                "async function renderLoginPage({ searchParams }) {\n  const { deactivated } = await searchParams;\n" +
                    "  return <LoginForm deactivated={deactivated} />;\n}\n",
                "renderLoginPage"
            )
        )
    );
}

if (isMain(import.meta.url)) standalone(title, run);
