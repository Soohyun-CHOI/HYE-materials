// A session lasts thirty days from sign-in, never longer for being used, and each
// sealed cookie's two lifetimes are one value (#471).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. iron-session gives a sealed cookie
// two lifetimes — the seal's `ttl`, checked when the seal is opened, and the
// cookie's `maxAge`, which decides when the browser drops it — and the session's
// had come apart: `maxAge` thirty days beside a comment saying so, no `ttl`, so the
// seal kept iron-session's default fourteen and every reader was signed out on day
// fourteen. Nothing in the tree could have said so, because the number a reader of
// the code saw was right and the one that decided was not written anywhere. So
// this file asks iron-session itself what it would set and seal.
//
//   THE OPTIONS ARE HANDED TO THE REAL LIBRARY, NOT RESTATED. A check comparing
//   `ttl` with `maxAge` in our own options object would pass on the defect's own
//   shape whenever both were written; what decided the session's life was how
//   iron-session READS options — given a `maxAge`, it leaves the `ttl` at its
//   default. So each cookie's options go through `getIronSession` with a cookie
//   store this file holds, are saved, and the cookie it sets and the seal inside it
//   are read back: the `maxAge` it would send, and the expiry it sealed.
//
//   AND THE FIGURES ARE LITERALS. 2592000 and 900 are typed out rather than
//   derived from `SESSION_DAYS` or `TOKEN_TTL_MINUTES`, because an assertion in
//   terms of the constant passes for any value it takes (`verification.md`'s #351
//   incident); changing a lifetime is a change to this file too.
//
// WHAT A PASS DOES NOT PROVE. That the running app sends what iron-session would
// set here — the pull request reads a real response's `Set-Cookie` for that, and
// opens the real seal with the thirty-day `ttl`. That a browser drops a cookie when
// `Max-Age` says, which is the browser's. And that nobody re-saves a session from a
// file this walk does not reach; the inventory below covers `app/` and `lib/`.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { getIronSession, unsealData } from "iron-session";
import { PENDING_SIGN_IN_COOKIE, SESSION_COOKIE, SESSION_DAYS } from "../../../lib/cookieLifetime.js";
import {
    callsTo,
    listJsFiles,
    parseFile,
    parseSource,
    repoPath,
    resolveFunction,
    toPosix,
    walk,
    REPO_ROOT,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A session lasts thirty days from sign-in, and a sealed cookie's two lifetimes are one (#471)";

/** A throwaway secret of the length iron-session demands. Seals made with it are discarded. */
const PASSWORD = "offline-cookie-lifetime-check-secret-000";

/** How far a sealed expiry may sit from now + ttl: the seal is made a moment after `now`. */
const SLACK_MS = 5000;

/**
 * Save a payload through iron-session with these options and hand back what it
 * would put in the browser: the cookie's options and its value.
 */
async function saveThrough(options, payload) {
    const jar = new Map();
    const store = {
        get: (name) => (jar.has(name) ? { name, value: jar.get(name).value } : undefined),
        set: (name, value, cookieOptions) => jar.set(name, { value, cookieOptions }),
    };
    const session = await getIronSession(store, { ...options, password: PASSWORD });
    Object.assign(session, payload);
    await session.save();
    return jar.get(options.cookieName) ?? null;
}

/**
 * The instant a seal stops opening, read out of the seal itself. iron-webcrypto
 * writes it as the sixth `*`-separated field, in milliseconds, before the MAC; and
 * iron-session appends `~2`, its own format version.
 */
function sealedExpiry(seal) {
    const [withoutVersion] = String(seal).split("~");
    return Number(withoutVersion.split("*")[5]);
}

/** Every `.js` under app/ and lib/, repo-relative and posix-separated. */
function sourceFiles() {
    const out = [];
    for (const dir of ["app", "lib"]) listJsFiles(repoPath(dir), out);
    return out.map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
}

/** Every property in a subtree whose key is one of `names`. */
function propertiesNamed(node, names) {
    const found = [];
    walk(node, (n) => {
        if (n.type === "Property" && names.includes(n.key?.name ?? n.key?.value)) found.push(n);
    });
    return found;
}

export async function run({ check, assert, log }) {
    // ── 1: the figures ───────────────────────────────────────────────────────
    log("each cookie's lifetime, as literals:");
    check("SESSION_DAYS", SESSION_DAYS, 30);
    check("the session seals for", SESSION_COOKIE.ttl, 2592000);
    check("  and its cookie lives", SESSION_COOKIE.cookieOptions.maxAge, 2592000);
    check("the pending sign-in seals for", PENDING_SIGN_IN_COOKIE.ttl, 900);
    check("  and its cookie lives", PENDING_SIGN_IN_COOKIE.cookieOptions.maxAge, 900);
    check("the session cookie is", SESSION_COOKIE.cookieName, "hye_session");
    check("the pending sign-in cookie is", PENDING_SIGN_IN_COOKIE.cookieName, "hye_sign_in");
    assert("neither can be changed from outside", Object.isFrozen(SESSION_COOKIE) && Object.isFrozen(SESSION_COOKIE.cookieOptions));

    // ── 2: what iron-session would set and seal ─────────────────────────────
    log("");
    log("handed to iron-session, each cookie ends when its seal does:");
    for (const [label, options, seconds] of [
        ["the session", SESSION_COOKIE, 2592000],
        ["the pending sign-in", PENDING_SIGN_IN_COOKIE, 900],
    ]) {
        const before = Date.now();
        const cookie = await saveThrough(options, { userId: "recOFFLINECHECK00" });
        assert(`${label} is set`, cookie !== null);
        if (!cookie) continue;
        check(`  ${label}'s cookie Max-Age`, cookie.cookieOptions.maxAge, seconds);
        const expiry = sealedExpiry(cookie.value);
        assert(
            `  ${label}'s seal expires ${seconds} seconds after it was made`,
            Math.abs(expiry - (before + seconds * 1000)) < SLACK_MS
        );
        const opened = await unsealData(cookie.value, { password: PASSWORD, ttl: options.ttl });
        check(`  and the seal opens with that ttl`, opened.userId, "recOFFLINECHECK00");
    }

    // ANTI-VACUITY, AND IT IS THE DEFECT ITSELF. The options the session carried
    // before this — a thirty-day `maxAge` and no `ttl` — go through the same
    // reading, and the seal has to come back at fourteen days. If it did not, the
    // parsing above would be reading something other than the expiry.
    const old = await saveThrough(
        { cookieName: "hye_session", cookieOptions: { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 } },
        { userId: "recOFFLINECHECK00" }
    );
    const oldDays = (sealedExpiry(old.value) - Date.now()) / 86400000;
    check("the old options set a thirty-day cookie", old.cookieOptions.maxAge, 2592000);
    assert(`  around a seal that ended at fourteen days (read ${oldDays.toFixed(2)})`, Math.abs(oldDays - 14) < 0.01);

    // ── 3: no lifetime is written anywhere else ─────────────────────────────
    log("");
    log("`lib/session.js` takes both lifetimes from the module and writes none:");
    const session = parseFile("lib/session.js");
    const lifetimes = propertiesNamed(session.ast, ["ttl", "maxAge"]);
    check("ttl or maxAge written in lib/session.js", lifetimes.length, 0);
    const imported = new Set();
    walk(session.ast, (n) => {
        if (n.type === "ImportDeclaration" && String(n.source.value).endsWith("cookieLifetime")) {
            for (const s of n.specifiers) imported.add(s.imported?.name);
        }
    });
    assert(
        "  it imports both cookies from lib/cookieLifetime.js",
        imported.has("SESSION_COOKIE") && imported.has("PENDING_SIGN_IN_COOKIE")
    );
    const ironCalls = callsTo(session.ast, "getIronSession");
    check("  and opens a sealed cookie in exactly two places", ironCalls.length, 2);
    const builtFrom = ironCalls.map((call) => call.arguments[1]?.name).sort().join(",");
    check("  with the two option sets built from them", builtFrom, "pendingSignInOptions,sessionOptions");

    // ── 4: a session is sealed at sign-in and never again ───────────────────
    // THIS IS THE "NEVER EXTENDED" HALF. A `.save()` re-seals with a fresh expiry,
    // so the property is that no read path saves. Every file under app/ and lib/
    // is walked; only `lib/session.js` may open a sealed cookie, and there only the
    // two writers may save.
    log("");
    log("a seal is written at sign-in and when a browser asks for an email, and nowhere else:");
    const openers = sourceFiles().filter((rel) => callsTo(parseFile(rel).ast, "getIronSession").length > 0);
    check("files that open a sealed cookie", openers.join(","), "lib/session.js");
    const savers = [];
    walk(session.ast, (n) => {
        if (n.type !== "FunctionDeclaration") return;
        if (callsTo(n, "save").length > 0) savers.push(n.id.name);
    });
    check("functions in lib/session.js that save one", savers.sort().join(","), "createSession,writePendingSignIn");
    check("getCurrentUser saves nothing", callsTo(resolveFunction(session.ast, "getCurrentUser"), "save").length, 0);
    const createSession = resolveFunction(session.ast, "createSession");
    check("createSession saves once", callsTo(createSession, "save").length, 1);
    const startSession = resolveFunction(parseFile("lib/auth.js").ast, "startSession");
    check("both ways in reach it through startSession", callsTo(startSession, "createSession").length, 1);

    // ── 5: the detectors, seen finding what they look for ───────────────────
    log("");
    log("and the detectors are seen finding a planted defect:");
    const planted = parseFile("lib/session.js").source.replace(
        "async function getSession() {",
        "async function getSession() {\n    const s = await getIronSession(await cookies(), { ...sessionOptions, ttl: 60 });\n    await s.save();"
    );
    const plantedAst = parseSource(planted, "<planted-session>").ast;
    assert("a lifetime written in lib/session.js is counted", propertiesNamed(plantedAst, ["ttl", "maxAge"]).length === 1);
    const plantedSavers = [];
    walk(plantedAst, (n) => {
        if (n.type === "FunctionDeclaration" && callsTo(n, "save").length > 0) plantedSavers.push(n.id.name);
    });
    assert("  and a read that saves is a third saver", plantedSavers.includes("getSession"));
}

if (isMain(import.meta.url)) standalone(title, run);
