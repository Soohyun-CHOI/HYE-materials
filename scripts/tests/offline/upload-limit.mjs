// The one ceiling every user upload is held to, and the two ways it comes apart (#146).
//
// THE QUIET MUTANT IS THE SERVER HALF NOBODY CALLS. The browser refuses an oversized
// file before `upload()` runs, so on every ordinary path the token route's ceiling is
// never the thing that says no — it could be missing, or wrong, and no form, no
// screen and no run of this suite would differ. The route is directly callable per
// #134's re-authorization convention, which is exactly the path on which that ceiling
// is the only refusal there is. Nothing in this tier can call Vercel Blob, so what is
// asserted here is that the ceiling REACHES the token; that it then refuses is proved
// by forging the call and watching Blob turn it down, which is in the pull request.
//
// THE SECOND MUTANT ALREADY HAPPENED, and that is why clause 1 is an inventory rather
// than three assertions. #146 was opened because `/api/invoices/upload` held the only
// ceiling as a literal and `/api/quotations/upload` held none. While it sat open, #162
// added a third route which copied the literal — its comment CITING this issue as it
// did — so "put the two limits in one place" was overtaken by a second place before
// anyone reached it. Fixing three routes changes nothing about the fourth. So the
// first thing asserted is that the inventory of upload routes is complete, and a new
// one fails this file until it is classified.
//
// AND THE SAME SHAPE ON THE CLIENT SIDE, one level less obvious. Five forms call the
// guard, so the interesting failure is not a form that skips it but a form that writes
// its own comparison — one rule, five implementations, drifting a byte at a time. The
// call is pinned as a call to the SHARED function, first statement inside the try the
// upload already sits in, so a form that inlines `file.size > …` fails clause 2 even
// though it refuses the same files today.
//
// WHAT THIS CANNOT SEE. That the guard's message reaches a reader — that needs a
// browser and is in the pull request. That Blob honors a signed ceiling on a MULTIPART
// upload — none of the five call sites enables multipart, and whether the ceiling
// still binds when a forged caller asks for it is a question about Vercel's API, not
// about this repository. And, as ever, source shape is not execution: a guard inside
// `if (false)` satisfies clause 2.

import { readFileSync } from "node:fs";
import {
    MAX_UPLOAD_BYTES,
    MULTIPART_REFUSAL,
    UPLOAD_LIMIT_COPY,
    describeBytes,
    refuseMultipartUpload,
    refuseOversizeUpload,
    uploadLimitRefusal,
} from "../../../lib/uploadLimit.js";
import { REPO_ROOT, listJsFiles, parseFile, parseSource, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One upload ceiling, in one place (#146)";

const LIMIT_MODULE = "@/lib/uploadLimit";

/**
 * THE ROUTE INVENTORY. Every client-upload token endpoint, and what it authorizes an
 * upload of. A route missing from here fails this file, and so does an entry with no
 * route — `offline/mail-money.mjs`'s shape for the senders and
 * `offline/edit-log-fields.mjs`'s for the labels.
 */
const TOKEN_ROUTES = {
    "app/api/quotations/upload/route.js": {
        what: "the vendor's quotation, attached by a requester on the PR form or on Edit and continue",
    },
    "app/api/invoices/upload/route.js": {
        what: "the vendor's invoice, entered by the office; Admin-only",
    },
    "app/api/deliveries/upload/route.js": {
        what: "the packing list photo, taken on site; #162, and the route that copied the literal",
    },
};

/**
 * THE FORM INVENTORY. Every `"use client"` file that calls `upload()`. Five call sites
 * across four screens, and they are listed by file rather than by screen because that
 * is what a new one is added as.
 */
const UPLOAD_FORMS = {
    "app/prs/new/PRForm.js": { screen: "/prs/new", what: "a quotation file per entry" },
    "app/prs/[prId]/EditAndContinueForm.js": {
        screen: "/prs/[prId]",
        what: "a quotation file added while a signer edits and continues",
    },
    "app/invoices/new/InvoiceForm.js": { screen: "/invoices/new", what: "the invoice file" },
    "app/deliveries/new/DeliveryForm.js": { screen: "/deliveries/new", what: "the packing list photo" },
    "app/deliveries/[deliveryId]/edit/DeliveryEditForm.js": {
        screen: "/deliveries/[deliveryId]/edit",
        what: "a replacement packing list photo",
    },
};

/** Repo-relative posix paths of every .js file under `dir`. */
function jsFilesUnder(dir) {
    return listJsFiles(`${REPO_ROOT}/${dir}`)
        .map((full) => toPosix(full).slice(toPosix(REPO_ROOT).length + 1))
        .sort();
}

/** Files whose source calls `handleUpload` — the structural mark of a token route. */
function tokenRouteFiles(files) {
    return files.filter((rel) => {
        const { ast } = parseFile(rel);
        let found = false;
        walk(ast, (n) => {
            if (n.type === "CallExpression" && n.callee?.name === "handleUpload") found = true;
        });
        return found;
    });
}

/** Files that import `upload` from `@vercel/blob/client` — the client half's mark. */
function clientUploadFiles(files) {
    return files.filter((rel) => {
        const { ast } = parseFile(rel);
        return ast.body.some(
            (n) =>
                n.type === "ImportDeclaration" &&
                n.source.value === "@vercel/blob/client" &&
                n.specifiers.some((s) => s.imported?.name === "upload")
        );
    });
}

/** Every `maximumSizeInBytes:` property node in a parsed file. */
function ceilingProperties(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "Property" && (n.key?.name === "maximumSizeInBytes" || n.key?.value === "maximumSizeInBytes")) {
            found.push(n);
        }
    });
    return found;
}

/** Does this file import `name` from lib/uploadLimit.js? */
function importsFromLimitModule(ast, name) {
    return ast.body.some(
        (n) =>
            n.type === "ImportDeclaration" &&
            n.source.value === LIMIT_MODULE &&
            n.specifiers.some((s) => s.imported?.name === name)
    );
}

/**
 * The innermost `try` block containing `target`, by source range. Range containment
 * rather than a parent walk because the same question is asked of a planted source
 * with no surrounding function.
 */
function enclosingTryBlock(ast, target) {
    let best = null;
    walk(ast, (n) => {
        if (n.type !== "TryStatement") return;
        const b = n.block;
        if (b.start <= target.start && target.end <= b.end) {
            if (!best || b.start > best.start) best = b;
        }
    });
    return best;
}

/**
 * Is the guard the first statement of the try that the `upload()` call sits in?
 *
 * Returns a reason string on failure rather than false, so a form that fails says
 * which of the four ways it failed.
 */
function guardsItsUpload(ast) {
    let call = null;
    walk(ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "upload" && !call) call = n;
    });
    if (!call) return "no upload() call found";
    const block = enclosingTryBlock(ast, call);
    if (!block) return "the upload() call is not inside a try";
    const first = block.body[0];
    const expr = first?.type === "ExpressionStatement" ? first.expression : null;
    if (expr?.type !== "CallExpression" || expr.callee?.name !== "refuseOversizeUpload") {
        return "the try does not open with refuseOversizeUpload(...)";
    }
    if (expr.arguments.length !== 1 || expr.arguments[0]?.type !== "Identifier") {
        return "refuseOversizeUpload is not called with the picked file";
    }
    return null;
}

/**
 * Does this route's `onBeforeGenerateToken` refuse a multipart request, using the
 * flag the callback is handed rather than a value of its own?
 *
 * The third parameter is what carries it, and a callback that declares no parameters
 * — which all three of these did before #146 — cannot refuse anything. Returns a
 * reason on failure, like `guardsItsUpload` below.
 */
function refusesMultipart(ast) {
    let callback = null;
    walk(ast, (n) => {
        if (n.type === "Property" && n.key?.name === "onBeforeGenerateToken" && !callback) callback = n.value;
    });
    if (!callback) return "no onBeforeGenerateToken callback found";
    const flag = callback.params?.[2];
    if (flag?.type !== "Identifier") return "the callback declares no multipart parameter";
    let call = null;
    walk(callback, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "refuseMultipartUpload" && !call) call = n;
    });
    if (!call) return "refuseMultipartUpload is not called";
    const arg = call.arguments[0];
    if (arg?.type !== "Identifier" || arg.name !== flag.name) {
        return "refuseMultipartUpload is not called with that parameter";
    }
    return null;
}

export function run({ check, assert, log }) {
    const appFiles = jsFilesUnder("app");
    const libFiles = jsFilesUnder("lib");

    // ── 1. the routes, which is what sees an upload path nobody has written yet ──
    log("THE QUIET MUTANT — a token route this file has never heard of:");
    const routes = tokenRouteFiles(appFiles);
    const classifiedRoutes = Object.keys(TOKEN_ROUTES).sort();
    check("every handleUpload route is classified here", routes.join(","), classifiedRoutes.join(","));
    assert("  and there are routes to classify at all", routes.length > 0);
    for (const [rel, entry] of Object.entries(TOKEN_ROUTES)) {
        assert(`  ${rel} — ${entry.what}`, Boolean(entry.what));
    }
    // ANTI-VACUITY: the walker has to be seen finding a route the table does not know,
    // or "the lists match" is what it reports for a walker that finds nothing.
    const plantedRoute = parseSource(
        'import { handleUpload } from "@vercel/blob/client";\n' +
            "export async function POST(request) { return handleUpload({ request }); }\n"
    );
    let plantedFound = false;
    walk(plantedRoute.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.name === "handleUpload") plantedFound = true;
    });
    assert("the route walker finds a handleUpload route in a source it has not seen", plantedFound);

    log("");
    log("and each mints the shared ceiling into its token:");
    for (const rel of routes) {
        const { ast } = parseFile(rel);
        const ceilings = ceilingProperties(ast);
        check(`  ${rel} sets exactly one ceiling`, ceilings.length, 1);
        const value = ceilings[0]?.value;
        assert(`  and it is an identifier, not a figure`, value?.type === "Identifier");
        check(`  and the identifier is the shared one`, value?.name ?? null, "MAX_UPLOAD_BYTES");
        assert(`  imported from ${LIMIT_MODULE}`, importsFromLimitModule(ast, "MAX_UPLOAD_BYTES"));
    }

    // ── 1b. and refuses the one request the ceiling does not cover ──────────────
    log("");
    log("THE CEILING DOES NOT BIND A MULTIPART UPLOAD, so every route refuses one:");
    for (const rel of routes) {
        const { ast } = parseFile(rel);
        assert(`  ${rel} imports the multipart refusal`, importsFromLimitModule(ast, "refuseMultipartUpload"));
        const reason = refusesMultipart(ast);
        assert(`  and calls it with onBeforeGenerateToken's own flag${reason ? ` — ${reason}` : ""}`, reason === null);
    }
    // ANTI-VACUITY: the shape test has to reject a callback that takes no flag, which
    // is what all three of these looked like before this issue.
    const noFlag = parseSource(
        "handleUpload({ onBeforeGenerateToken: async () => ({ access: 'public' }) });"
    );
    assert("a token callback that ignores the multipart flag fails", refusesMultipart(noFlag.ast) !== null);
    const wrongArg = parseSource(
        "handleUpload({ onBeforeGenerateToken: async (pathname, clientPayload, multipart) =>" +
            " { refuseMultipartUpload(false); return {}; } });"
    );
    assert("  and so does one that passes something other than the flag", refusesMultipart(wrongArg.ast) !== null);

    // ── 2. the forms, and that all five call the SAME thing ─────────────────────
    log("");
    log("THE SECOND MUTANT — one rule, five implementations:");
    const forms = clientUploadFiles(appFiles);
    const classifiedForms = Object.keys(UPLOAD_FORMS).sort();
    check("every client upload() call site is classified here", forms.join(","), classifiedForms.join(","));
    assert("  and there are call sites to classify at all", forms.length > 0);
    for (const [rel, entry] of Object.entries(UPLOAD_FORMS)) {
        assert(`  ${rel} (${entry.screen}) — ${entry.what}`, Boolean(entry.what));
    }
    for (const rel of forms) {
        const { ast } = parseFile(rel);
        assert(`  ${rel} imports the shared guard`, importsFromLimitModule(ast, "refuseOversizeUpload"));
        const reason = guardsItsUpload(ast);
        assert(`  and opens its upload's try with it${reason ? ` — ${reason}` : ""}`, reason === null);
    }
    // ANTI-VACUITY: both halves of clause 2 have to reject something. A form that
    // writes its own comparison is the mutation that matters, because it refuses the
    // same files today and drifts tomorrow.
    const ownComparison = parseSource(
        "async function onChange(e) { const file = e.target.files[0];\n" +
            "  try { if (file.size > 20 * 1024 * 1024) throw new Error('too big');\n" +
            "    const blob = await upload(file.name, file, {}); } catch (err) {} }\n"
    );
    assert(
        "a form with its own size comparison fails the guard test",
        guardsItsUpload(ownComparison.ast) !== null
    );
    const noTry = parseSource("async function onChange(file) { const blob = await upload(file.name, file, {}); }");
    assert("  and so does an upload with no try around it", guardsItsUpload(noTry.ast) !== null);
    const guarded = parseSource(
        "async function onChange(file) { try { refuseOversizeUpload(file);\n" +
            "  const blob = await upload(file.name, file, {}); } catch (err) {} }\n"
    );
    assert("  while the shape the five forms use passes", guardsItsUpload(guarded.ast) === null);

    // ── 3. no second literal anywhere ───────────────────────────────────────────
    log("");
    log("no ceiling is written as a figure anywhere under app/ or lib/:");
    const stray = [];
    for (const rel of [...appFiles, ...libFiles]) {
        const { ast } = parseFile(rel);
        for (const prop of ceilingProperties(ast)) {
            if (prop.value?.type !== "Identifier") stray.push(rel);
        }
    }
    check("files setting a ceiling to something other than the constant", stray.join(","), "");
    // ANTI-VACUITY: the literal test has to be seen saying no to the exact shape #162
    // committed, or clause 3 is "no properties found" wearing a pass.
    const plantedLiteral = parseSource("const opts = { maximumSizeInBytes: 20 * 1024 * 1024 };");
    const plantedProps = ceilingProperties(plantedLiteral.ast);
    assert("the literal test finds the shape #162 copied", plantedProps.length === 1);
    assert("  and rejects it", plantedProps[0]?.value?.type !== "Identifier");
    // And the figure itself is not spelled anywhere else either — the module is where
    // it is explained, so a duplicate elsewhere is a second place to read it.
    const spelled = [...appFiles, ...libFiles].filter(
        (rel) => rel !== "lib/uploadLimit.js" && /20\s*\*\s*1024\s*\*\s*1024/.test(readFileSync(`${REPO_ROOT}/${rel}`, "utf8"))
    );
    check("the figure is spelled outside lib/uploadLimit.js", spelled.join(","), "");

    // ── 4. the predicate, at the boundary and either side of it ─────────────────
    log("");
    log("the limit itself:");
    check("the ceiling is 20 MB in bytes", MAX_UPLOAD_BYTES, 20 * 1024 * 1024);
    check("a small file is not refused", uploadLimitRefusal(1024), null);
    // STRICTLY GREATER, matching the Blob SDK's own `> maximumSizeInBytes`. A `>=`
    // here would refuse in the browser what the server accepts, and the one input
    // where the two halves disagree is the one nobody uploads by accident.
    check("a file of exactly the limit is not refused", uploadLimitRefusal(MAX_UPLOAD_BYTES), null);
    assert("one byte over is refused", uploadLimitRefusal(MAX_UPLOAD_BYTES + 1) !== null);
    check("a missing size is not refused", uploadLimitRefusal(undefined), null);

    log("");
    log("and the words it refuses with:");
    const refusal = uploadLimitRefusal(25_480_000);
    check("the sentence names both sizes", refusal, "This file is larger than the upload limit — 24.3 MB against 20 MB");
    assert("  and ends without a period, because every form appends to it", !refusal.endsWith("."));
    // ROUNDING UP IS THE POINT, not a detail: a file one byte over the line rendered
    // as `20.0 MB against 20 MB` reads as a file at a limit it was just refused for.
    check("a hair over the limit still prints over it", describeBytes(MAX_UPLOAD_BYTES + 1), "20.1 MB");
    check("  and the limit itself prints whole", describeBytes(MAX_UPLOAD_BYTES), "20 MB");
    assert(
        "  a to-nearest rounding would have printed the confusing one",
        (Math.round((MAX_UPLOAD_BYTES + 1) / (1024 * 1024) * 10) / 10).toFixed(1) === "20.0"
    );
    // The builder renders both figures, so no call site has a formatting step to get
    // wrong — the shape `offline/mail-money.mjs` pins for a mail's money.
    const built = UPLOAD_LIMIT_COPY.tooLarge({ bytes: 25_480_000, limitBytes: MAX_UPLOAD_BYTES });
    check("the copy builder renders the same sentence", built, refusal);

    log("");
    log("and the guard the five forms call:");
    let thrown = null;
    try {
        refuseOversizeUpload({ size: MAX_UPLOAD_BYTES + 1, name: "big.pdf" });
    } catch (err) {
        thrown = err.message;
    }
    check("an oversized file throws the refusal", thrown, refusal.replace("24.3 MB", "20.1 MB"));
    let threwForSmall = false;
    try {
        refuseOversizeUpload({ size: 1024, name: "small.pdf" });
    } catch {
        threwForSmall = true;
    }
    assert("a file within the limit passes through silently", !threwForSmall);

    let multipartMessage = null;
    try {
        refuseMultipartUpload(true);
    } catch (err) {
        multipartMessage = err.message;
    }
    check("a multipart request is refused", multipartMessage, MULTIPART_REFUSAL);
    let threwForSingle = false;
    try {
        refuseMultipartUpload(false);
    } catch {
        threwForSingle = true;
    }
    assert("  and an ordinary one is not", !threwForSingle);
    let threwForAbsent = false;
    try {
        refuseMultipartUpload(undefined);
    } catch {
        threwForAbsent = true;
    }
    // The SDK omits the flag rather than sending `false` on some paths, so absent has
    // to mean single-part — otherwise this refuses every upload the app makes.
    assert("  and an absent flag is not a multipart request", !threwForAbsent);
}

if (isMain(import.meta.url)) standalone(title, run);
