// How often a sign-in email may be asked for (#148).
//
// WHAT THIS FILE IS FOR. A request for an email is held to three ceilings, counted over
// the `Auth Tokens` rows earlier requests made — per mailbox over ten minutes and over a
// day, and per IP over a day — and `Resend email` rests between two emails. Two kinds of
// claim follow, and this file holds both:
//
//   WHAT IS JUDGED, by behavior. `lib/signInLimit.js` is pure, so the mailbox an address
//   counts against, the IP a header counts as, the verdict at and around every ceiling,
//   and the time a refusal names are called here with plain values. So is the one claim
//   the settled numbers have to keep: pressing `Resend email` each time it comes back
//   never reaches the ten-minute ceiling. The expected values are typed out rather than
//   derived from the constants, so a changed ceiling fails here until somebody looks.
//
//   HOW IT IS WIRED, on the AST. `lib/auth.js`, `lib/airtable/authTokens.js` and the
//   request route reach a credential or `next/headers`, so they cannot be imported in
//   this tier; what they do is not callable here, and how they are built is. The read
//   comes before the row and the row before the email, one lock holds the read and the
//   write, the row carries what the read compares, the route hands on the header Vercel
//   sets and answers a refusal with when to try again.
//
//   AND HOW THE SCREENS TAKE IT. One module asks for an email and reads the answer —
//   called here with a stand-in `fetch` — every control that asks takes a ceiling's
//   answer, the wait's count is kept out of the line's announcements, and the code step
//   and the page take the rest's length from one module.
//
// WHAT A PASS DOES NOT PROVE. That Airtable answers the read the way the formula reads —
// a formula is outside this tier entirely (`docs/notes/verification.md`) — or that a row
// made a moment earlier is seen by the next request's read. Both are measured in
// `verify-sign-in-limit-148.mjs`. And that a browser draws a refusal or the count where
// the design puts them, or a screen reader stays quiet through the count, which are a
// browser's properties and are in the pull request.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import {
    ipKeyOf,
    judgeSignInRequest,
    mailboxOf,
    RESEND_COOLDOWN_MS,
    resendWaitLeft,
    retryAfterSeconds,
    SIGN_IN_CEILINGS,
    SIGN_IN_LOOKBACK_MS,
    SIGN_IN_READ_PAGE,
    UNKNOWN_IP,
} from "../../../lib/signInLimit.js";
import { ASKED, askForEmail } from "../../../app/login/askForEmail.js";
import {
    callsBefore,
    callsTo,
    insideCallTo,
    listJsFiles,
    parseFile,
    parseSource,
    REPO_ROOT,
    resolveFunction,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { relative } from "path";

export const title = "How often a sign-in email may be asked for (#148)";

const AUTH = "lib/auth.js";
const TOKENS = "lib/airtable/authTokens.js";
const ROUTE = "app/api/auth/request/route.js";

/** The moment every judgment below is made at. */
const NOW = Date.parse("2026-10-05T12:00:00.000Z");
const MINUTE = 60 * 1000;

/** Rows made `minutesAgo` before NOW, sharing what `shares` says. */
const rowsAgo = (minutesAgo, shares) =>
    minutesAgo.map((m) => ({ createdAt: new Date(NOW - m * MINUTE).toISOString(), ...shares }));
const steps = (count, first, step) => Array.from({ length: count }, (_, i) => first + i * step);
const MAILBOX_ONLY = { mailbox: true, ip: false };
const IP_ONLY = { mailbox: false, ip: true };

/** The property names of the object literal handed to `call` at `index`. */
function argKeys(call, index) {
    const arg = call?.arguments[index];
    if (arg?.type !== "ObjectExpression") return [];
    return arg.properties.map((p) => p.key?.name ?? p.key?.value).sort();
}

/** The identifier a property of that object literal names, for `{ ipKey }` or `{ ipKey: x }`. */
function argValueName(call, index, key) {
    const arg = call?.arguments[index];
    if (arg?.type !== "ObjectExpression") return null;
    const prop = arg.properties.find((p) => (p.key?.name ?? p.key?.value) === key);
    return prop?.value?.type === "Identifier" ? prop.value.name : null;
}

/** The keys of every `NextResponse.json(body, { status })` answering with `status`. */
function answeredWith(fn, status) {
    const found = [];
    walk(fn, (n) => {
        if (n.type !== "CallExpression" || n.callee?.property?.name !== "json") return;
        const init = n.arguments[1];
        if (init?.type !== "ObjectExpression") return;
        const statusProp = init.properties.find((p) => p.key?.name === "status");
        if (statusProp?.value?.type !== "Literal" || statusProp.value.value !== status) return;
        const body = n.arguments[0];
        found.push(body?.type === "ObjectExpression" ? body.properties.map((p) => p.key?.name).sort().join(",") : "");
    });
    return found;
}

/** Every `x.get("<name>")` call in a subtree that reads that header. */
function headerReads(fn, name) {
    return callsTo(fn, "get").filter((c) => c.arguments[0]?.type === "Literal" && c.arguments[0].value === name);
}

/** The value of a property named `key` anywhere inside the first `.create(...)` call. */
function createdField(fn, key) {
    let value = null;
    const create = callsTo(fn, "create")[0];
    walk(create, (n) => {
        if (value === null && n.type === "Property" && (n.key?.name ?? n.key?.value) === key) value = n.value;
    });
    return value;
}

/** The literal text of the one `filterByFormula` template in a function, its holes left out. */
function formulaText(fn) {
    let text = null;
    walk(fn, (n) => {
        if (n.type === "Property" && n.key?.name === "filterByFormula" && n.value?.type === "TemplateLiteral") {
            text = n.value.quasis.map((q) => q.value.cooked).join("…");
        }
    });
    return text;
}

/** Every declaration of `name` under app/ and lib/, as repo-relative paths. */
function declarationsOf(name, files) {
    const found = [];
    for (const { rel, ast } of files) {
        walk(ast, (n) => {
            if (
                (n.type === "FunctionDeclaration" && n.id?.name === name) ||
                (n.type === "VariableDeclarator" && n.id?.name === name)
            )
                found.push(rel);
        });
    }
    return found;
}

/** Every file under app/ and lib/ that writes an object property called `key`. */
function writersOf(key, files) {
    const found = new Set();
    for (const { rel, ast } of files) {
        walk(ast, (n) => {
            if (n.type === "Property" && (n.key?.name ?? n.key?.value) === key) found.add(rel);
        });
    }
    return [...found].sort();
}

/** A function declared under `name` anywhere in a module, a default export's included. */
function functionNamed(ast, name) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = n;
    });
    return found;
}

/** How often a subtree reads `ASKED.LIMITED` — a ceiling's answer taken. */
function takesLimit(fn) {
    let count = 0;
    walk(fn, (n) => {
        if (n.type === "MemberExpression" && n.object?.name === "ASKED" && n.property?.name === "LIMITED") count += 1;
    });
    return count;
}

/** Every call in a module that posts to the request route — anything but `Change`'s DELETE. */
function postsToRequestRoute(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type !== "CallExpression" || n.callee?.name !== "fetch") return;
        if (n.arguments[0]?.type !== "Literal" || n.arguments[0].value !== "/api/auth/request") return;
        const init = n.arguments[1];
        const method = init?.type === "ObjectExpression" ? init.properties.find((p) => p.key?.name === "method")?.value?.value : null;
        if (method !== "DELETE") found.push(n);
    });
    return found;
}

/** Ask for an email at `times` (ms), one after another, until one is refused. */
function pressUntilRefused(times) {
    const rows = [];
    for (const t of times) {
        const verdict = judgeSignInRequest(rows, t);
        if (verdict.limited) return { sent: rows.length, verdict };
        rows.push({ createdAt: new Date(t).toISOString(), mailbox: true, ip: true });
    }
    return { sent: rows.length, verdict: { limited: false } };
}

export async function run({ check, assert, log }) {
    // ── 1: the mailbox an address counts against ────────────────────────────
    log("the mailbox an address counts against:");
    const MAILBOXES = [
        ["an address as it is", "soo@example.com", "soo@example.com"],
        ["another case", "Soo@Example.COM", "soo@example.com"],
        ["a + tag", "soo+code471@example.com", "soo@example.com"],
        ["a + tag in another case", "SOO+Name473@EXAMPLE.com", "soo@example.com"],
        ["two + signs, cut at the first", "soo+a+b@example.com", "soo@example.com"],
        ["a dot is kept", "soo.kim@example.com", "soo.kim@example.com"],
        ["a hyphen is kept", "soo-kim@example.com", "soo-kim@example.com"],
        ["a local part that is only a tag", "+tag@example.com", "@example.com"],
    ];
    for (const [label, email, expected] of MAILBOXES) check(`  ${label}`, mailboxOf(email), expected);

    // ── 2: the IP a header counts as ─────────────────────────────────────────
    log("");
    log("the IP an x-forwarded-for header counts as:");
    const IPS = [
        ["IPv4", "203.0.113.7", "v4:203.0.113.7"],
        ["the first of a list", "203.0.113.7, 198.51.100.1", "v4:203.0.113.7"],
        ["spaces around it", "  203.0.113.7 ", "v4:203.0.113.7"],
        ["IPv4-mapped IPv6", "::ffff:203.0.113.7", "v4:203.0.113.7"],
        ["IPv4-mapped IPv6 written in hex", "::ffff:cb00:7107", "v4:203.0.113.7"],
        ["IPv6 in full", "2001:db8:1:2:3:4:5:6", "v6:2001:db8:1:2::/64"],
        ["another IPv6 address in that /64", "2001:db8:1:2::9", "v6:2001:db8:1:2::/64"],
        ["IPv6 in capitals with leading zeros", "2001:0DB8:0001:0002:aaaa::", "v6:2001:db8:1:2::/64"],
        ["IPv6 in brackets", "[2001:db8:1:2::9]", "v6:2001:db8:1:2::/64"],
        ["the next /64 is another IP", "2001:db8:1:3::9", "v6:2001:db8:1:3::/64"],
        ["IPv6 with a zone", "fe80::1%eth0", "v6:fe80:0:0:0::/64"],
        ["IPv6 loopback", "::1", "v6:0:0:0:0::/64"],
        ["IPv6 ending in an IPv4 address", "64:ff9b::203.0.113.7", "v6:64:ff9b:0:0::/64"],
        ["IPv4 loopback", "127.0.0.1", "v4:127.0.0.1"],
        ["no header", null, UNKNOWN_IP],
        ["an empty header", "", UNKNOWN_IP],
        ["not an IP", "not-an-ip", UNKNOWN_IP],
        ["three octets", "203.0.113", UNKNOWN_IP],
        ["an octet over 255", "256.0.113.7", UNKNOWN_IP],
        ["two ::, even after eight groups", "2001:db8:1:2:3:4:5:6::1::2", UNKNOWN_IP],
        ["a group of five digits", "12345::1", UNKNOWN_IP],
        ["nine groups", "1:2:3:4:5:6:7:8:9", UNKNOWN_IP],
        ["an IPv4 address with a port", "203.0.113.7:8080", UNKNOWN_IP],
    ];
    for (const [label, header, expected] of IPS) check(`  ${label}`, ipKeyOf(header), expected);
    check("  and every header that is no IP shares one key", UNKNOWN_IP, "unknown");

    // ── 3: the judgment at and around every ceiling ─────────────────────────
    log("");
    log("the judgment at and around every ceiling:");
    check("no rows at all", JSON.stringify(judgeSignInRequest([], NOW)), JSON.stringify({ limited: false }));

    const recent = rowsAgo(steps(11, 0.5, 0.5), MAILBOX_ONLY);
    check("ten emails to one mailbox in ten minutes are allowed", judgeSignInRequest(recent.slice(0, 10), NOW).limited, false);
    const eleven = judgeSignInRequest(recent, NOW);
    check("  the next after eleven is refused", eleven.limited, true);
    check("  until the oldest of them is ten minutes old", eleven.retryAt, "2026-10-05T12:04:30.000Z");
    check(
        "  and a refusal says that and nothing more",
        Object.keys(eleven).sort().join(","),
        "limited,retryAt"
    );
    const edge = rowsAgo([...steps(10, 0.5, 0.5), 10], MAILBOX_ONLY);
    check("a row exactly ten minutes old no longer counts", judgeSignInRequest(edge, NOW).limited, false);

    const day = rowsAgo(steps(20, 60, 60), MAILBOX_ONLY);
    check("nineteen emails to one mailbox in a day are allowed", judgeSignInRequest(day.slice(0, 19), NOW).limited, false);
    const twenty = judgeSignInRequest(day, NOW);
    check("  the next after twenty is refused", twenty.limited, true);
    check("  until the oldest of the twenty is a day old", twenty.retryAt, "2026-10-05T16:00:00.000Z");

    const host = rowsAgo(steps(50, 20, 20), IP_ONLY);
    check("forty-nine emails from one IP in a day are allowed", judgeSignInRequest(host.slice(0, 49), NOW).limited, false);
    const fifty = judgeSignInRequest(host, NOW);
    check("  the next after fifty is refused", fifty.limited, true);
    check("  until the oldest of the fifty is a day old", fifty.retryAt, "2026-10-05T19:20:00.000Z");

    const ipBurst = rowsAgo(steps(30, 0.3, 0.3), IP_ONLY);
    check("rows that share only the IP leave the mailbox's ceilings alone", judgeSignInRequest(ipBurst, NOW).limited, false);
    const shared = [...rowsAgo(steps(49, 20, 20), IP_ONLY), ...rowsAgo(steps(11, 25, 60), MAILBOX_ONLY)];
    check("rows that share only the mailbox leave the IP's ceiling alone", judgeSignInRequest(shared, NOW).limited, false);
    const both = [...rowsAgo(steps(11, 0.5, 0.5), MAILBOX_ONLY), ...rowsAgo(steps(9, 60, 60), MAILBOX_ONLY)];
    check("two ceilings reached: the later time", judgeSignInRequest(both, NOW).retryAt, "2026-10-06T03:00:00.000Z");
    const past = rowsAgo(steps(15, 0.5, 0.5), MAILBOX_ONLY);
    check("past a ceiling, the time is the row that reached it", judgeSignInRequest(past, NOW).retryAt, "2026-10-05T12:04:30.000Z");
    const unreadable = [...rowsAgo(steps(10, 0.5, 0.5), MAILBOX_ONLY), { createdAt: "not a date", ...MAILBOX_ONLY }];
    check("a row with no readable time is not counted", judgeSignInRequest(unreadable, NOW).limited, false);
    check("Retry-After is whole seconds to that time", retryAfterSeconds(eleven.retryAt, NOW), 270);
    check("  and never less than one", retryAfterSeconds("2026-10-05T11:00:00.000Z", NOW), 1);

    // ── 4: the settled values ───────────────────────────────────────────────
    log("");
    log("the settled values:");
    check(
        "the three ceilings",
        JSON.stringify(SIGN_IN_CEILINGS),
        JSON.stringify([
            { per: "mailbox", windowMs: 600000, ceiling: 11 },
            { per: "mailbox", windowMs: 86400000, ceiling: 20 },
            { per: "ip", windowMs: 86400000, ceiling: 50 },
        ])
    );
    check("Resend email rests a minute", RESEND_COOLDOWN_MS, 60000);
    check("the read looks back a day", SIGN_IN_LOOKBACK_MS, 86400000);
    check("and takes one page of a hundred", SIGN_IN_READ_PAGE, 100);

    // ── 5: the rest and the ten-minute ceiling are matched ──────────────────
    log("");
    log("pressing Resend email each time it comes back never reaches the ten-minute ceiling:");
    const [tenMinutes] = SIGN_IN_CEILINGS;
    assert(
        "ten rests cover the ten-minute window",
        (tenMinutes.ceiling - 1) * RESEND_COOLDOWN_MS >= tenMinutes.windowMs
    );
    const paced = pressUntilRefused(steps(40, NOW, RESEND_COOLDOWN_MS));
    check("  a rest after every email: the first refusal comes after", paced.sent, 20);
    check("  and it is the day's ceiling", paced.verdict.retryAt, "2026-10-06T12:00:00.000Z");
    const eager = pressUntilRefused([NOW, ...steps(39, NOW + 1, RESEND_COOLDOWN_MS)]);
    check("  the first resend pressed at once: the first refusal comes after", eager.sent, 20);
    check("  and it is the day's ceiling too", eager.verdict.retryAt, "2026-10-06T12:00:00.000Z");
    const unrested = pressUntilRefused(steps(40, NOW, 1000));
    check("  with no rest at all the ten-minute ceiling is what refuses", unrested.sent, 11);

    log("");
    log("what is left of the rest, from the time an email was asked for:");
    check("  asked for this moment: all of it", resendWaitLeft(NOW, NOW), 60000);
    check("  fifteen seconds on", resendWaitLeft(NOW - 15000, NOW), 45000);
    check("  a minute on: none", resendWaitLeft(NOW - 60000, NOW), 0);
    check("  long after: none", resendWaitLeft(NOW - 90000, NOW), 0);
    check("  a time nobody knows: none", resendWaitLeft(null, NOW), 0);
    check("  a time never written: none", resendWaitLeft(undefined, NOW), 0);
    check("  a time ahead of this clock: no more than all of it", resendWaitLeft(NOW + 30000, NOW), 60000);

    // ── 6: the one read stays one page ──────────────────────────────────────
    log("");
    log("the one read a request makes is one page and cannot cut a verdict short:");
    const dayCeilings = SIGN_IN_CEILINGS.filter((c) => c.windowMs === SIGN_IN_LOOKBACK_MS);
    assert(
        "the day's ceilings together fit in the page",
        dayCeilings.reduce((sum, c) => sum + c.ceiling, 0) <= SIGN_IN_READ_PAGE
    );
    const unrefused = [];
    for (let shareMailbox = 0; shareMailbox <= SIGN_IN_READ_PAGE; shareMailbox += 5) {
        const page = [
            ...rowsAgo(steps(shareMailbox, 11, 10), MAILBOX_ONLY),
            ...rowsAgo(steps(SIGN_IN_READ_PAGE - shareMailbox, 11, 10), IP_ONLY),
        ];
        if (!judgeSignInRequest(page, NOW).limited) unrefused.push(shareMailbox);
    }
    check("  a full page is refused however it divides", unrefused.join(","), "");

    // ── 7: requestMagicLink holds every request before it makes a row ───────
    log("");
    log("requestMagicLink holds a request to the ceilings before it makes a row:");
    const auth = parseFile(AUTH);
    const requestLink = resolveFunction(auth.ast, "requestMagicLink");
    assert("requestMagicLink resolves", Boolean(requestLink));
    check("  it turns the header into an IP with ipKeyOf", callsTo(requestLink, "ipKeyOf").length, 1);
    check("  it reads once", callsTo(requestLink, "getRecentSignInRows").length, 1);
    assert("  before it makes the row", callsBefore(requestLink, "getRecentSignInRows", "createAuthToken"));
    assert("  and judges before it makes the row", callsBefore(requestLink, "judgeSignInRequest", "createAuthToken"));
    assert("  and makes the row before it sends the email", callsBefore(requestLink, "createAuthToken", "sendMagicLinkEmail"));
    const locks = callsTo(requestLink, "withKeyLock");
    check("  one lock", locks.length, 1);
    const read = callsTo(requestLink, "getRecentSignInRows")[0];
    const made = callsTo(requestLink, "createAuthToken")[0];
    assert("  holds the read", Boolean(read) && insideCallTo(requestLink, read, "withKeyLock"));
    assert("  and the write", Boolean(made) && insideCallTo(requestLink, made, "withKeyLock"));
    check("  and is keyed on the mailbox", locks[0] ? callsTo(locks[0].arguments[0], "mailboxOf").length : 0, 1);
    check("  the read is given the IP", argValueName(read, 0, "ipKey"), "ipKey");
    check("  and the row is given the same one", argValueName(made, 1, "ipKey"), "ipKey");

    // ── 8: the route hands on the header and answers a refusal ──────────────
    log("");
    log("the route hands on the header Vercel sets, and answers a refusal with when to try again:");
    const route = parseFile(ROUTE);
    const post = resolveFunction(route.ast, "POST");
    assert("POST resolves", Boolean(post));
    check("  it reads x-forwarded-for once", headerReads(post, "x-forwarded-for").length, 1);
    check(
        "  and hands requestMagicLink a forwardedFor",
        argKeys(callsTo(post, "requestMagicLink")[0], 1).includes("forwardedFor"),
        true
    );
    check("  a refusal is a 429 with when to try again and nothing else", answeredWith(post, 429).join(" | "), "limited,retryAt");
    check("  and a Retry-After from the same time", callsTo(post, "retryAfterSeconds").length, 1);

    // ── 9: the row carries what the read compares ───────────────────────────
    log("");
    log("the row carries what the read compares, from one implementation of each:");
    const tokens = parseFile(TOKENS);
    const create = resolveFunction(tokens.ast, "createAuthToken");
    const readRows = resolveFunction(tokens.ast, "getRecentSignInRows");
    assert("createAuthToken and getRecentSignInRows resolve", Boolean(create && readRows));
    const mailboxValue = createdField(create, "Mailbox");
    check("  the row's Mailbox is mailboxOf's", mailboxValue?.type === "CallExpression" ? mailboxValue.callee?.name : null, "mailboxOf");
    const ipValue = createdField(create, "IP Hash");
    check("  and its IP Hash is ipHashOf's", ipValue?.type === "CallExpression" ? ipValue.callee?.name : null, "ipHashOf");
    const formula = formulaText(readRows) ?? "";
    assert("  the read takes the window by Created At", formula.includes('IS_AFTER({Created At}, "'));
    assert("  only rows a request made", formula.includes('{IP Hash} != ""'));
    assert("  sharing the mailbox", formula.includes('{Mailbox} = "'));
    assert("  or the IP", formula.includes('{IP Hash} = "'));
    check("  and compares each row with mailboxOf", callsTo(readRows, "mailboxOf").length, 1);
    check("  and with ipHashOf", callsTo(readRows, "ipHashOf").length, 1);
    check("  in one page", callsTo(readRows, "firstPage").length, 1);
    check("  and never pages on", callsTo(readRows, "all").length, 0);

    const files = [];
    for (const dir of ["app", "lib"]) {
        for (const full of listJsFiles(`${REPO_ROOT}/${dir}`)) {
            const rel = toPosix(relative(REPO_ROOT, full));
            files.push({ rel, ast: parseFile(rel).ast });
        }
    }
    check("mailboxOf is declared once, in lib/signInLimit.js", declarationsOf("mailboxOf", files).join(","), "lib/signInLimit.js");
    check("ipKeyOf is declared once, in lib/signInLimit.js", declarationsOf("ipKeyOf", files).join(","), "lib/signInLimit.js");
    check("ipHashOf is declared once, in the table's module", declarationsOf("ipHashOf", files).join(","), TOKENS);
    check("only the table's module writes a Mailbox", writersOf("Mailbox", files).join(","), TOKENS);
    check("  or an IP Hash", writersOf("IP Hash", files).join(","), TOKENS);

    // ── 10: the screens ask one way and take a ceiling's answer ─────────────
    log("");
    log("every control that asks for an email asks one way, and takes a ceiling's answer:");
    const realFetch = globalThis.fetch;
    const answered = async (respond) => {
        globalThis.fetch = respond;
        try {
            return await askForEmail({ email: "soo@example.com", destination: "" });
        } finally {
            globalThis.fetch = realFetch;
        }
    };
    check("an email that went", await answered(async () => ({ ok: true, status: 200 })), ASKED.SENT);
    check("one a ceiling held back", await answered(async () => ({ ok: false, status: 429 })), ASKED.LIMITED);
    check("a refusal of another kind", await answered(async () => ({ ok: false, status: 400 })), ASKED.FAILED);
    check(
        "a request that never arrived",
        await answered(async () => {
            throw new Error("offline");
        }),
        ASKED.FAILED
    );
    const posters = files.filter(({ ast }) => postsToRequestRoute(ast).length > 0).map(({ rel }) => rel);
    check("one module asks the request route for an email", posters.join(","), "app/login/askForEmail.js");
    const form = parseFile("app/login/LoginForm.js");
    const confirm = parseFile("app/login/confirm/SendNewEmail.js");
    assert("Continue takes a ceiling's answer", takesLimit(functionNamed(form.ast, "EmailStep")) > 0);
    assert("  Resend email and an ended code's Send new email take it", takesLimit(functionNamed(form.ast, "CodeStep")) > 0);
    assert("  and an ended link's Send new email takes it", takesLimit(functionNamed(confirm.ast, "SendNewEmail")) > 0);
    const silentCounts = [];
    walk(form.ast, (n) => {
        if (n.type !== "JSXElement") return;
        const quiet = n.openingElement.attributes.some(
            (a) => a.type === "JSXAttribute" && a.name?.name === "aria-live" && a.value?.value === "off"
        );
        if (quiet) silentCounts.push(callsTo(n, "resendIn").length);
    });
    check("the wait's count is kept out of the line's announcements", silentCounts.join(","), "1");
    const formImports = [];
    walk(form.ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === "@/lib/signInLimit") {
            for (const s of n.specifiers) formImports.push(s.imported?.name);
        }
    });
    check("the code step takes the rest from lib/signInLimit.js", formImports.sort().join(","), "RESEND_COOLDOWN_MS,resendWaitLeft");
    const page = parseFile("app/login/page.js");
    check(
        "the page hands the form what is left of it",
        callsTo(resolveFunction(page.ast, "renderLoginPage"), "resendWaitLeft").length,
        1
    );

    // ── 11: the detectors, seen finding what they look for ──────────────────
    log("");
    log("and the detectors are seen finding a planted defect:");
    const secondAsker = parseSource(
        'export async function ask() {\n  return fetch("/api/auth/request", { method: "POST", body: "{}" });\n}\n',
        "<second-asker>"
    );
    check("a second module asking the route is found", postsToRequestRoute(secondAsker.ast).length, 1);
    const deaf = parseSource("function EmailStep() {\n  if (asked === ASKED.SENT) return;\n}\n", "<deaf-control>");
    check("a control that never takes a ceiling's answer is reported", takesLimit(functionNamed(deaf.ast, "EmailStep")), 0);
    const early = parseSource(
        "async function requestMagicLink(email) {\n" +
            "  const row = await createAuthToken(email, { ipKey });\n" +
            "  judgeSignInRequest(await getRecentSignInRows({ email, ipKey, since }), now);\n" +
            "}\n",
        "<row-before-read>"
    );
    assert(
        "a request that makes its row before reading is reported",
        !callsBefore(resolveFunction(early.ast, "requestMagicLink"), "getRecentSignInRows", "createAuthToken")
    );
    const unlocked = parseSource(
        "async function requestMagicLink(email) {\n" +
            "  await withKeyLock(`k:${mailboxOf(email)}`, async () => null);\n" +
            "  await getRecentSignInRows({ email, ipKey, since });\n" +
            "}\n",
        "<read-outside-lock>"
    );
    const unlockedFn = resolveFunction(unlocked.ast, "requestMagicLink");
    assert(
        "a read outside the lock is reported",
        !insideCallTo(unlockedFn, callsTo(unlockedFn, "getRecentSignInRows")[0], "withKeyLock")
    );
    const headerless = parseSource(
        "export async function POST(request) {\n  return requestMagicLink(email, { baseUrl });\n}\n",
        "<no-header>"
    );
    check("a route that never reads the header is reported", headerReads(resolveFunction(headerless.ast, "POST"), "x-forwarded-for").length, 0);
    const unmarked = parseSource(
        "async function createAuthToken(email) {\n  return base(T).create({ Token: t, Email: email });\n}\n",
        "<no-mailbox>"
    );
    check("a row written without its Mailbox is reported", createdField(resolveFunction(unmarked.ast, "createAuthToken"), "Mailbox"), null);
    const secondCopy = parseSource("export function mailboxOf(email) { return email; }\n", "<second-copy>");
    check(
        "and a second mailboxOf is counted",
        declarationsOf("mailboxOf", [...files, { rel: "lib/elsewhere.js", ast: secondCopy.ast }]).length,
        2
    );
}

if (isMain(import.meta.url)) standalone(title, run);
