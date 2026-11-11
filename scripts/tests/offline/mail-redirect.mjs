// Outside production, no mail but a sign-in reaches the people the base names (#633).
//
// THE RULE. Local development and every preview deployment reach the test base, whose `Users`
// and `Vendors` are the live base's people (#534). So outside the production deployment every
// mail but a sign-in goes to `EMAIL_REDIRECT_TO` alone, its subject naming whom it was meant
// for, or is not sent; the production deployment sends exactly what it sent before. Four
// things are held here, each of which would let a mail reach a real person from a run that is
// not production:
//
//   1. WHICH RUN IS PRODUCTION, BY VALUE. `lib/deployment.js:isProductionDeployment` over
//      environments built in this file: `production` is, and an unset variable, a preview,
//      development, another case or another name is not. No file but that module reads
//      `VERCEL_ENV`, and none but `lib/mailRedirect.js` reads `EMAIL_REDIRECT_TO` — a second
//      reading is a second judgment, and `lib/airtableBase.js`, which read it itself until
//      #633, is held to asking the module.
//   2. WHERE A MAIL GOES, BY VALUE. `routeMail` hands production and a sign-in the SAME object
//      it was given, so nothing about it can have changed; anywhere else it hands back the
//      message addressed to the redirect alone, `cc` and `bcc` gone, the subject naming every
//      address it was meant for and everything else the sender's; with no redirect, null.
//   3. EVERY SEND IN `lib/email.js` ASKS IT. One call to Resend, inside `deliver`, sending
//      what `routeMail` answered and logging what it withheld; every exported sender calls
//      `deliver`, touches Resend no other way, and only `sendMagicLinkEmail` says it is a
//      sign-in. A planted file breaking each of those is seen to break it.
//   4. NOTHING ELSE SENDS MAIL. No file but `lib/email.js` imports Resend or names its API's
//      host, so no send can go round `deliver`.
//
// THE FILE LIST IS GIT'S, tracked and untracked-not-ignored, as `airtable-base.mjs` reads it,
// so a new file is held before it is committed. This tier's own directory is left out of the
// reads in 1 and 4, since its checks — this one first — plant the names on purpose.
//
// WHAT IT CANNOT SEE. A variable or a host built at runtime (`"VERCEL_" + kind`) is no whole
// string and no member read, and nothing in the tree does that. Mail sent from outside this
// repository — an Airtable automation, Vercel's own notices — is outside it. Whether Vercel's
// Preview scope holds `EMAIL_REDIRECT_TO` is the dashboard's, and what a redirected mail looks
// like in a mailbox was proved by sending one, which is in the pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isProductionDeployment } from "../../../lib/deployment.js";
import { MAIL_REDIRECT_COPY, routeMail } from "../../../lib/mailRedirect.js";
import { REPO_ROOT, calleeName, callsTo, parentMap, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Outside production, no mail but a sign-in reaches the people the base names (#633)";

const EMAIL = "lib/email.js";
const DEPLOYMENT = "lib/deployment.js";
const MAIL_REDIRECT = "lib/mailRedirect.js";
const AIRTABLE_BASE = "lib/airtableBase.js";

/** Each variable, and the one module that may read it. */
const OWNERS = { VERCEL_ENV: DEPLOYMENT, EMAIL_REDIRECT_TO: MAIL_REDIRECT };

/** The files the repository has or is about to have, as git lists them. */
function repositoryFiles() {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 1 << 26,
    });
    return [...new Set(out.split("\0").filter(Boolean))].sort();
}

const inScope = (path) =>
    /\.(m?js|jsx)$/.test(path) &&
    !path.startsWith("scripts/tests/offline/") &&
    (/^(app|lib|scripts)\//.test(path) || !path.includes("/"));

/** Every read of an owned variable in a parsed source, as `NAME at offset`: a member, a whole string. */
function variableReads(ast) {
    const names = Object.keys(OWNERS);
    const findings = [];
    walk(ast, (node) => {
        if (node.type === "Literal" && names.includes(node.value)) findings.push(`${node.value} at ${node.start}`);
        if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
            const text = node.quasis[0]?.value?.cooked;
            if (names.includes(text)) findings.push(`${text} at ${node.start}`);
        }
        if (node.type === "MemberExpression" && !node.computed && names.includes(node.property?.name)) {
            findings.push(`${node.property.name} at ${node.start}`);
        }
    });
    return findings;
}

/** Every way a source reaches Resend itself: an import of the package, a `require`, its API's host. */
function resendReaches(ast) {
    const findings = [];
    const isResend = (value) => typeof value === "string" && (value === "resend" || value.startsWith("resend/"));
    walk(ast, (node) => {
        if ((node.type === "ImportDeclaration" || node.type === "ImportExpression") && isResend(node.source?.value)) {
            findings.push(`imports resend at ${node.start}`);
        }
        if (node.type === "CallExpression" && calleeName(node) === "require" && isResend(node.arguments[0]?.value)) {
            findings.push(`requires resend at ${node.start}`);
        }
        if (node.type === "Literal" && typeof node.value === "string" && node.value.includes("api.resend.com")) {
            findings.push(`names api.resend.com at ${node.start}`);
        }
        if (node.type === "TemplateElement" && (node.value?.cooked ?? "").includes("api.resend.com")) {
            findings.push(`names api.resend.com at ${node.start}`);
        }
    });
    return findings;
}

/** The exported `send*Email` names a source declares. */
function senderNames(ast) {
    const found = [];
    for (const node of ast.body) {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : null;
        if (decl?.type === "FunctionDeclaration" && /^send.*Email$/.test(decl.id?.name || "")) found.push(decl.id.name);
    }
    return found.sort();
}

/** The name of the top-level function a node sits in, or null at the top level. */
function enclosingFunction(ast, node) {
    const parents = parentMap(ast);
    let cur = parents.get(node);
    let last = null;
    while (cur) {
        if (cur.type === "FunctionDeclaration" && cur.id) last = cur.id.name;
        cur = parents.get(cur);
    }
    return last;
}

/**
 * Every way a parsed `lib/email.js` lets a mail past the redirect, as sentences — empty when
 * none does. The rules: `resend` is touched once, by `resend.emails.send` inside `deliver`;
 * that call sends the binding `routeMail` answered, after the withheld case is logged;
 * `routeMail` is handed the message and `signIn` alone, so it reads the run's own environment;
 * every exported sender calls `deliver` once, and only `sendMagicLinkEmail` says `signIn: true`.
 */
function emailFindings(ast) {
    const findings = [];
    // Every reference to the client but its own declaration.
    const uses = [];
    walk(ast, (node) => {
        if (node.type === "Identifier" && node.name === "resend") uses.push(node);
    });
    const declared = uses.filter((node) => {
        let isDeclaration = false;
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id === node) isDeclaration = true;
        });
        return isDeclaration;
    });
    if (declared.length !== 1) findings.push(`the client is declared ${declared.length} times`);
    for (const use of uses.filter((node) => !declared.includes(node))) {
        const where = enclosingFunction(ast, use) ?? "the top level";
        if (where !== "deliver") findings.push(`${where} touches resend`);
    }

    const deliver = resolveFunction(ast, "deliver");
    if (!deliver) return [...findings, "no deliver"];
    const sends = [];
    walk(deliver, (node) => {
        if (
            node.type === "CallExpression" &&
            node.callee?.type === "MemberExpression" &&
            node.callee.property?.name === "send" &&
            node.callee.object?.type === "MemberExpression" &&
            node.callee.object.object?.name === "resend"
        ) {
            sends.push(node);
        }
    });
    if (sends.length !== 1) findings.push(`deliver calls resend.emails.send ${sends.length} times`);
    const routes = callsTo(deliver, "routeMail");
    if (routes.length !== 1) findings.push(`deliver calls routeMail ${routes.length} times`);
    const route = routes[0];
    const send = sends[0];
    if (route && send) {
        if (route.start > send.start) findings.push("deliver sends before it routes");
        let bound = null;
        walk(deliver, (node) => {
            if (node.type === "VariableDeclarator" && node.init === route) bound = node.id?.name ?? null;
        });
        const sent = send.arguments[0];
        if (!(sent?.type === "Identifier" && bound !== null && sent.name === bound)) {
            findings.push("deliver sends something other than routeMail's answer");
        }
        if (route.arguments.length !== 2) findings.push("deliver hands routeMail an environment of its own");
        if (route.arguments[0]?.type !== "Identifier" || route.arguments[0].name !== deliver.params[0]?.name) {
            findings.push("deliver routes something other than the message it was handed");
        }
        const withheld = callsTo(deliver, "notSent")[0];
        if (!withheld) findings.push("deliver logs no withheld mail");
        else if (withheld.start > send.start) findings.push("deliver logs a withheld mail after it sends");
    }

    for (const name of senderNames(ast)) {
        const fn = resolveFunction(ast, name);
        const calls = callsTo(fn, "deliver");
        if (calls.length !== 1) {
            findings.push(`${name} calls deliver ${calls.length} times`);
            continue;
        }
        let signIn = null;
        for (const arg of calls[0].arguments.slice(1)) {
            walk(arg, (node) => {
                if (node.type === "Property" && (node.key?.name === "signIn" || node.key?.value === "signIn")) {
                    signIn = node.value?.type === "Literal" ? node.value.value : "not a literal";
                }
            });
        }
        if (name === "sendMagicLinkEmail" && signIn !== true) findings.push("sendMagicLinkEmail does not say it is a sign-in");
        if (name !== "sendMagicLinkEmail" && signIn !== null) findings.push(`${name} says signIn`);
    }
    return findings;
}

export function run({ check, assert, log }) {
    // ── 1. which run is production ───────────────────────────────────────────
    log("isProductionDeployment, by value:");
    check("  VERCEL_ENV=production is production", isProductionDeployment({ VERCEL_ENV: "production" }), true);
    check("  read trimmed, as resolveAirtableBase always read it", isProductionDeployment({ VERCEL_ENV: " production\n" }), true);
    check("  a preview is not", isProductionDeployment({ VERCEL_ENV: "preview" }), false);
    check("  development is not", isProductionDeployment({ VERCEL_ENV: "development" }), false);
    check("  no VERCEL_ENV is not — a local next dev or next start", isProductionDeployment({}), false);
    check("  an empty VERCEL_ENV is not", isProductionDeployment({ VERCEL_ENV: "" }), false);
    check("  another case is not", isProductionDeployment({ VERCEL_ENV: "Production" }), false);
    check("  another name for it is not", isProductionDeployment({ VERCEL_ENV: "prod" }), false);
    check("  a value that is not text is not", isProductionDeployment({ VERCEL_ENV: true }), false);
    check("  no environment at all is not", isProductionDeployment(null), false);
    check("  naming the live base is not", isProductionDeployment({ AIRTABLE_BASE: "live" }), false);

    log("");
    log("lib/airtableBase.js asks it rather than reading the variable:");
    const baseAst = parseFile(AIRTABLE_BASE).ast;
    const importsJudgment = baseAst.body.some(
        (node) =>
            node.type === "ImportDeclaration" &&
            node.source.value === "./deployment.js" &&
            node.specifiers.some((s) => s.imported?.name === "isProductionDeployment")
    );
    assert("  it imports isProductionDeployment, its extension spelled out", importsJudgment);
    const resolve = resolveFunction(baseAst, "resolveAirtableBase");
    assert("  and resolveAirtableBase calls it", resolve !== null && callsTo(resolve, "isProductionDeployment").length === 1);

    log("");
    log("no file but its module reads either variable:");
    const files = repositoryFiles();
    assert("  the listing is a whole tree", files.length > 300);
    for (const expected of [DEPLOYMENT, MAIL_REDIRECT, EMAIL, AIRTABLE_BASE, "proxy.js", "next.config.mjs"]) {
        assert(`  the listing holds ${expected}`, files.includes(expected));
    }
    const jsFiles = files.filter(inScope);
    assert("  more than two hundred JavaScript files were read", jsFiles.length > 200);
    const parsed = new Map(jsFiles.map((path) => [path, parseSource(readFileSync(join(REPO_ROOT, path), "utf8"), path).ast]));
    const reads = [];
    for (const [path, ast] of parsed) {
        for (const finding of variableReads(ast)) reads.push({ path, name: finding.split(" ")[0], finding });
    }
    assert("  lib/deployment.js is seen to read VERCEL_ENV", reads.some((r) => r.path === DEPLOYMENT && r.name === "VERCEL_ENV"));
    assert(
        "  lib/mailRedirect.js is seen to read EMAIL_REDIRECT_TO",
        reads.some((r) => r.path === MAIL_REDIRECT && r.name === "EMAIL_REDIRECT_TO")
    );
    check(
        "  no other file reads either",
        reads
            .filter((r) => r.path !== OWNERS[r.name])
            .map((r) => `${r.path}: ${r.finding}`)
            .join("; "),
        ""
    );
    // ANTI-VACUITY: the walker has to see each shape of read, and has to leave the label the
    // base module writes alone, which carries the name inside a longer string.
    check(
        "  the walker sees a member read, a computed one and a whole string",
        variableReads(
            parseSource(
                'const a = process.env.VERCEL_ENV;\nconst b = env["EMAIL_REDIRECT_TO"];\nconst c = `VERCEL_ENV`;\nconst d = "VERCEL_ENV=production";'
            ).ast
        )
            .map((f) => f.split(" ")[0])
            .join(","),
        "VERCEL_ENV,EMAIL_REDIRECT_TO,VERCEL_ENV"
    );

    // ── 2. where a mail goes ─────────────────────────────────────────────────
    log("");
    log("routeMail, by value:");
    const REDIRECT = "redirect@hanyangengusa.com";
    const MESSAGE = {
        from: "Portal <portal@hanyangengusa.com>",
        to: "signer@hanyangengusa.com",
        replyTo: "requester@hanyangengusa.com",
        subject: "Action needed: PR HYE-PR-260101-01",
        html: "<p>It's your turn.</p>",
        text: "It's your turn.",
        attachments: [{ filename: "HYE-PO-260101-01.pdf", content: "JVBERi0=" }],
    };
    const PRODUCTION = { VERCEL_ENV: "production", EMAIL_REDIRECT_TO: REDIRECT };
    const PREVIEW = { VERCEL_ENV: "preview", EMAIL_REDIRECT_TO: REDIRECT };
    check("  production is handed the same object", routeMail(MESSAGE, {}, PRODUCTION) === MESSAGE, true);
    check(
        "  with no redirect named, the same object too",
        routeMail(MESSAGE, {}, { VERCEL_ENV: "production" }) === MESSAGE,
        true
    );
    check("  a sign-in on a preview is handed the same object", routeMail(MESSAGE, { signIn: true }, PREVIEW) === MESSAGE, true);
    check(
        "  and with no redirect named, it is still sent",
        routeMail(MESSAGE, { signIn: true }, { VERCEL_ENV: "preview" }) === MESSAGE,
        true
    );
    check("  a sign-in in production, the same object", routeMail(MESSAGE, { signIn: true }, PRODUCTION) === MESSAGE, true);

    const routed = routeMail(MESSAGE, {}, PREVIEW);
    assert("  a preview is handed a message", routed !== null && routed !== MESSAGE);
    if (routed) {
        check("  addressed to the redirect alone", routed.to, REDIRECT);
        check("  its subject naming whom it was meant for", routed.subject, "[Meant for signer@hanyangengusa.com] Action needed: PR HYE-PR-260101-01");
        check("  the body untouched", routed.html, MESSAGE.html);
        check("  the text untouched", routed.text, MESSAGE.text);
        check("  the attachments the same list", routed.attachments === MESSAGE.attachments, true);
        check("  the sender and the reply path kept", `${routed.from} | ${routed.replyTo}`, `${MESSAGE.from} | ${MESSAGE.replyTo}`);
        check("  and no field added", Object.keys(routed).sort().join(","), Object.keys(MESSAGE).sort().join(","));
    }
    check("  the sender's own message is left as it was", `${MESSAGE.to} | ${MESSAGE.subject}`, "signer@hanyangengusa.com | Action needed: PR HYE-PR-260101-01");

    const copied = routeMail(
        { ...MESSAGE, to: ["first@example.com", "second@example.com"], cc: "cc@example.com", bcc: ["bcc@example.com"] },
        {},
        PREVIEW
    );
    check("  a copy and a blind copy are dropped", `${"cc" in copied} ${"bcc" in copied} ${copied.to}`, `false false ${REDIRECT}`);
    check(
        "  and the subject names every address, in order",
        copied.subject,
        "[Meant for first@example.com, second@example.com, cc@example.com, bcc@example.com] Action needed: PR HYE-PR-260101-01"
    );
    check("  the redirect is read trimmed", routeMail(MESSAGE, {}, { EMAIL_REDIRECT_TO: `  ${REDIRECT}\n` })?.to, REDIRECT);
    for (const [label, env] of [
        ["  a run with no VERCEL_ENV is redirected", { EMAIL_REDIRECT_TO: REDIRECT }],
        ["  development is redirected", { VERCEL_ENV: "development", EMAIL_REDIRECT_TO: REDIRECT }],
        ["  another case of production is redirected", { VERCEL_ENV: "Production", EMAIL_REDIRECT_TO: REDIRECT }],
        ["  a run naming the live base is redirected", { AIRTABLE_BASE: "live", EMAIL_REDIRECT_TO: REDIRECT }],
    ]) {
        check(label, routeMail(MESSAGE, {}, env)?.to, REDIRECT);
    }
    for (const [label, env] of [
        ["  no redirect on a preview: nothing is sent", { VERCEL_ENV: "preview" }],
        ["  no redirect and no VERCEL_ENV: nothing is sent", {}],
        ["  an empty redirect: nothing is sent", { EMAIL_REDIRECT_TO: "" }],
        ["  a blank redirect: nothing is sent", { VERCEL_ENV: "preview", EMAIL_REDIRECT_TO: "   " }],
        ["  a redirect that is not text: nothing is sent", { EMAIL_REDIRECT_TO: ["soo@hanyangengusa.com"] }],
    ]) {
        check(label, routeMail(MESSAGE, {}, env), null);
    }
    check(
        "  the withheld mail's log line, naming the subject and no person",
        MAIL_REDIRECT_COPY.notSent({ subject: MESSAGE.subject }),
        'Mail not sent: this run is not the production deployment and EMAIL_REDIRECT_TO is unset — "Action needed: PR HYE-PR-260101-01"'
    );

    // ── 3. every send in lib/email.js asks it ────────────────────────────────
    log("");
    log("every send in lib/email.js goes through deliver, which asks routeMail first:");
    const email = parseFile(EMAIL).ast;
    check("  lib/email.js lets no mail past the redirect", emailFindings(email).join("; "), "");
    const senders = senderNames(email);
    check(
        "  and its five senders are the ones read",
        senders.join(","),
        "sendMagicLinkEmail,sendPOAwaitingSignatureEmail,sendPOSignedEmail,sendPOToVendorEmail,sendSignerTurnEmail"
    );
    const importsRoute = email.body.some(
        (node) =>
            node.type === "ImportDeclaration" &&
            node.source.value === "./mailRedirect" &&
            node.specifiers.some((s) => s.imported?.name === "routeMail")
    );
    assert("  routeMail is lib/mailRedirect.js's", importsRoute);
    // ANTI-VACUITY: each rule, broken in a planted file, is seen broken — and the planted
    // file's rule-keeping half is the shape lib/email.js has, so it is seen keeping it.
    const KEPT =
        'import { Resend } from "resend";\n' +
        "const resend = new Resend(key);\n" +
        "async function deliver(message, { signIn = false } = {}) {\n" +
        "  const routed = routeMail(message, { signIn });\n" +
        "  if (routed === null) { console.warn(MAIL_REDIRECT_COPY.notSent({ subject: message.subject })); return { data: null, error: null }; }\n" +
        "  return resend.emails.send(routed);\n" +
        "}\n" +
        "export async function sendMagicLinkEmail({ to }) { const { error } = await deliver({ to }, { signIn: true }); if (error) throw new Error(error); }\n" +
        "export async function sendSignerTurnEmail({ to }) { const { error } = await deliver({ to }); if (error) throw new Error(error); }\n";
    check("  a planted file keeping every rule has no finding", emailFindings(parseSource(KEPT).ast).join("; "), "");
    const planted = (from, to) => emailFindings(parseSource(KEPT.replace(from, to)).ast).join("; ");
    check(
        "  a sender calling Resend itself is seen",
        planted("const { error } = await deliver({ to }); if", "const { error } = await resend.emails.send({ to }); if"),
        "sendSignerTurnEmail touches resend; sendSignerTurnEmail calls deliver 0 times"
    );
    check(
        "  a second sign-in is seen",
        planted("await deliver({ to }); if", "await deliver({ to }, { signIn: true }); if"),
        "sendSignerTurnEmail says signIn"
    );
    check(
        "  a sign-in that does not say so is seen",
        planted("deliver({ to }, { signIn: true })", "deliver({ to })"),
        "sendMagicLinkEmail does not say it is a sign-in"
    );
    check(
        "  sending the message rather than the answer is seen",
        planted("return resend.emails.send(routed);", "return resend.emails.send(message);"),
        "deliver sends something other than routeMail's answer"
    );
    check(
        "  sending before routing is seen",
        planted(
            "  const routed = routeMail(message, { signIn });\n",
            "  resend.emails.send(message);\n  const routed = routeMail(message, { signIn });\n"
        ),
        "deliver calls resend.emails.send 2 times; deliver sends before it routes; " +
            "deliver sends something other than routeMail's answer; deliver logs a withheld mail after it sends"
    );
    check(
        "  an environment handed to routeMail is seen",
        planted("routeMail(message, { signIn })", "routeMail(message, { signIn }, {})"),
        "deliver hands routeMail an environment of its own"
    );
    check(
        "  routing something else is seen",
        planted("routeMail(message, { signIn })", "routeMail({ ...message }, { signIn })"),
        "deliver routes something other than the message it was handed"
    );
    check(
        "  a withheld mail not logged is seen",
        planted("console.warn(MAIL_REDIRECT_COPY.notSent({ subject: message.subject })); ", ""),
        "deliver logs no withheld mail"
    );
    check(
        "  a client used at the top level is seen",
        planted("const resend = new Resend(key);\n", "const resend = new Resend(key);\nresend.batch.send([]);\n"),
        "the top level touches resend"
    );

    // ── 4. nothing else sends mail ───────────────────────────────────────────
    log("");
    log("no file but lib/email.js reaches Resend:");
    const reaches = [];
    for (const [path, ast] of parsed) {
        for (const finding of resendReaches(ast)) reaches.push({ path, finding });
    }
    assert("  lib/email.js is seen to import it", reaches.some((r) => r.path === EMAIL && r.finding.startsWith("imports resend")));
    check(
        "  no other file does, or names its API",
        reaches
            .filter((r) => r.path !== EMAIL)
            .map((r) => `${r.path}: ${r.finding}`)
            .join("; "),
        ""
    );
    // ANTI-VACUITY: each way round the funnel is seen.
    check(
        "  the walker sees an import, a require, a dynamic import and the API's host",
        resendReaches(
            parseSource(
                'import { Resend } from "resend";\nconst r = require("resend");\nconst m = await import("resend");\nfetch(`https://api.resend.com/emails`);\nfetch("https://api.resend.com/emails");'
            ).ast
        )
            .map((f) => f.replace(/ at \d+$/, ""))
            .join(","),
        "imports resend,requires resend,imports resend,names api.resend.com,names api.resend.com"
    );
}

if (isMain(import.meta.url)) standalone(title, run);
