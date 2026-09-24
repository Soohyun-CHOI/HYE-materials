// Every file url handed to Airtable is on this app's own Blob store (#438).
//
// THE RULE WAS ONE LINE IN CLAUDE.md AND NOTHING HELD IT. Five Server Actions handed
// Airtable a url the caller supplied without asking where it pointed, the two that
// did ask used a predicate admitting every Vercel customer's public store, and no
// check could have said so — the line is prose. So this file holds the rule in four
// parts, each able to fail on a path nobody has written yet.
//
//   1. THE PREDICATE, by value: our store's host passes, and another customer's store
//      — the #438 mutant, a host suffix — is refused, as are Airtable's own urls, http,
//      a port, credentials and look-alike hosts. The expected host is written out
//      rather than derived from the function, since an assertion comparing a value
//      with an expression over that same value holds for any value it takes.
//   2. THE WRITERS: every write of an attachment field under app/ and lib/ sits inside
//      a declared service function, and each of those asks `assertOurBlobFiles` about
//      the value it writes before it writes it. A new write somewhere else fails.
//   3. THE CALL SITES, as an inventory: every call of a writer is classified as
//      carrying a CALLER's url or a SERVER's `put()`. A caller's has to be refused by
//      `isOurBlobUrl` earlier in its function than the first write and outside every
//      try — a refusal that leans on a rollback is not one that writes nothing. A
//      server's has to be `blob.url` off a `put()` in the same function. A call site
//      this file has not heard of fails until somebody classifies it, which is the
//      question a new path has to answer.
//   4. THE LITERAL NET: every `[{ url: … }]` under app/ and lib/ is either inside a
//      declared writer or handed to one as its file. That is what sees a NEW
//      attachment field, whose writer part 2 has no name for — its value still has
//      to be built somewhere, and this is the shape it is built in.
//
// WHAT THIS CANNOT SEE. Source order is not execution order (`_ast.mjs`): a guard
// inside `if (false)` passes part 3, and so does one whose answer is thrown away. A
// caller handing a writer an array it received whole — a JSON field passed straight
// through — builds no literal for part 4 to find. Both are why the writers' own
// assertion exists: it runs whatever the call site did, so a url that is not ours
// never reaches Airtable. And none of this runs an action; that a refusal writes
// nothing is `verify-file-source-438.mjs`'s, against the running app and the base.

import { assertOurBlobFiles, isOurBlobUrl } from "../../../lib/fileSource.js";
import {
    REPO_ROOT,
    calleeName,
    callsTo,
    insideTry,
    listJsFiles,
    parseFile,
    parseSource,
    resolveFunction,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every attachment url is on our own Blob store (#438)";

/**
 * A synthetic environment naming the store `AbCdEf123`. Not a credential for
 * anything: it is the SHAPE @vercel/blob parses (`vercel_blob_rw_<storeId>_<secret>`),
 * and the functions under test take the environment as an argument so that nothing
 * here sets a process variable.
 */
const TOKEN_ENV = { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbCdEf123_notARealSecret" };
const OIDC_ENV = { BLOB_STORE_ID: "store_AbCdEf123" };
/** Written out, not derived — see the header's note on a second path. */
const OUR_URL = "https://abcdef123.public.blob.vercel-storage.com/quotation-Xy12.pdf";

/**
 * THE WRITER INVENTORY. Every attachment field this app writes, by the service module
 * that owns its table, and the functions allowed to write it. A write anywhere else
 * fails part 2; an entry naming a writer that no longer writes fails it too.
 */
const ATTACHMENT_WRITERS = {
    "lib/airtable/quotations.js": { field: "File", writers: ["createQuotation"] },
    "lib/airtable/invoices.js": { field: "File", writers: ["createInvoice"] },
    "lib/airtable/deliveries.js": { field: "Packing List File", writers: ["createDelivery", "replaceDeliveryPhoto"] },
    "lib/airtable/directPurchases.js": { field: "File", writers: ["createDirectPurchase"] },
    "lib/airtable/purchaseOrders.js": { field: "PO PDF File", writers: ["updatePO"] },
};

const FIELD_NAMES = new Set(Object.values(ATTACHMENT_WRITERS).map((entry) => entry.field));
const WRITER_NAMES = new Set(Object.values(ATTACHMENT_WRITERS).flatMap((entry) => entry.writers));
/** The argument property a writer takes its attachment under. */
const FILE_PROPERTIES = new Set(["file", "poPdfFile"]);

/**
 * THE CALL-SITE INVENTORY. `fn` is the function the call sits in, resolved the way
 * `_ast.mjs:resolveFunction` follows a wrapped export to its handler. `firstWrites`
 * names what the function writes BEFORE the attachment writer, where it writes
 * anything — the refusal has to precede those too.
 */
const FILE_SOURCES = [
    {
        file: "app/prs/new/actions.js",
        fn: "persistPRFromForm",
        writer: "createQuotation",
        source: "caller",
        firstWrites: ["updatePR", "createPR"],
        what: "a quotation entry on the request form; saveDraftAction and createPRAction both reach it",
    },
    {
        file: "app/prs/[prId]/actions.js",
        fn: "editAndContinueAction",
        writer: "createQuotation",
        source: "caller",
        what: "a quotation a signer adds on Edit and continue",
    },
    {
        file: "app/invoices/new/actions.js",
        fn: "createInvoiceAction",
        writer: "createInvoice",
        source: "caller",
        what: "the invoice file on /invoices/new",
    },
    {
        file: "app/invoices/new/actions.js",
        fn: "createDirectPurchaseAction",
        writer: "createDirectPurchase",
        source: "caller",
        what: "the vendor's invoice recorded as a direct purchase",
    },
    {
        file: "app/deliveries/new/actions.js",
        fn: "createDeliveryAction",
        writer: "createDelivery",
        source: "caller",
        what: "the packing list photo on /deliveries/new",
    },
    {
        file: "app/deliveries/[deliveryId]/actions.js",
        fn: "replaceDeliveryPhotoAction",
        writer: "replaceDeliveryPhoto",
        source: "caller",
        what: "a replacement packing list photo",
    },
    {
        file: "lib/overagePR.js",
        fn: "createOverageDraft",
        writer: "createQuotation",
        source: "server",
        what: "the invoice's own file, re-uploaded as the overage request's quotation (#167)",
    },
    {
        file: "lib/directPurchaseClaim.js",
        fn: "claimDirectPurchase",
        writer: "createQuotation",
        source: "server",
        what: "the direct purchase's file, re-uploaded as the claimed request's quotation (#272)",
    },
    {
        file: "lib/poPdf.js",
        fn: "generateAndAttachPOPdf",
        writer: "updatePO",
        source: "server",
        what: "the generated order document",
    },
];

/** Repo-relative posix paths of every .js file under `dir`. */
function jsFilesUnder(dir) {
    return listJsFiles(`${REPO_ROOT}/${dir}`)
        .map((full) => toPosix(full).slice(toPosix(REPO_ROOT).length + 1))
        .sort();
}

function keyName(prop) {
    if (prop?.type !== "Property") return null;
    if (prop.key?.type === "Identifier" && !prop.computed) return prop.key.name;
    if (prop.key?.type === "Literal") return String(prop.key.value);
    return null;
}

function contains(outer, inner) {
    return Boolean(outer) && outer.start <= inner.start && inner.end <= outer.end;
}

function lineOf(source, node) {
    return source.slice(0, node.start).split("\n").length;
}

function isClientFile(ast) {
    return ast.body.some((n) => n.type === "ExpressionStatement" && n.directive === "use client");
}

/**
 * Every write of an attachment field in a parsed file: a key in an object literal,
 * or `fields["PO PDF File"] = …` — the two shapes the writers use.
 */
function attachmentWrites(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "ObjectExpression") {
            for (const prop of n.properties) {
                const name = keyName(prop);
                if (name && FIELD_NAMES.has(name)) found.push({ node: prop, field: name, value: prop.value });
            }
        }
        if (
            n.type === "AssignmentExpression" &&
            n.left?.type === "MemberExpression" &&
            n.left.computed &&
            n.left.property?.type === "Literal" &&
            FIELD_NAMES.has(String(n.left.property.value))
        ) {
            found.push({ node: n, field: String(n.left.property.value), value: n.right });
        }
    });
    return found;
}

/** Does this written value come from `name` — the identifier itself, or `name || []`? */
function valueComesFrom(value, name) {
    if (value?.type === "Identifier") return value.name === name;
    if (value?.type === "LogicalExpression") return value.left?.type === "Identifier" && value.left.name === name;
    return false;
}

/**
 * Why a declared writer does not hold the rule, or null. Every write it makes is of
 * the value it asked about, and it asked before the first of them — naming itself,
 * so the throw says which writer refused.
 */
function writerRefusal(fnNode, writerName, writes) {
    if (!fnNode) return "the function could not be resolved";
    const own = writes.filter((w) => contains(fnNode, w.node));
    if (own.length === 0) return "it writes no attachment field";
    const assertion = callsTo(fnNode, "assertOurBlobFiles")[0];
    if (!assertion) return "it never calls assertOurBlobFiles";
    if (!own.every((w) => assertion.start < w.node.start)) return "the assertion comes after a write";
    const [callerArg, filesArg] = assertion.arguments;
    if (callerArg?.type !== "Literal" || callerArg.value !== writerName) {
        return `the assertion does not name its caller as "${writerName}"`;
    }
    if (filesArg?.type !== "Identifier") return "the assertion is not asked about a named value";
    if (!own.every((w) => valueComesFrom(w.value, filesArg.name))) {
        return `a write is of something other than the \`${filesArg.name}\` it asked about`;
    }
    return null;
}

/** Every call of an attachment writer; `updatePO` only where it is handed a PDF. */
function writerCalls(ast) {
    const found = [];
    walk(ast, (n) => {
        const name = calleeName(n);
        if (!name || !WRITER_NAMES.has(name)) return;
        if (
            name === "updatePO" &&
            !n.arguments.some(
                (a) => a.type === "ObjectExpression" && a.properties.some((p) => keyName(p) === "poPdfFile")
            )
        ) {
            return;
        }
        found.push({ node: n, writer: name });
    });
    return found;
}

/** The value a writer call is handed as its attachment, or null. */
function fileArgument(call) {
    for (const arg of call.arguments) {
        if (arg.type !== "ObjectExpression") continue;
        const prop = arg.properties.find((p) => FILE_PROPERTIES.has(keyName(p)));
        if (prop) return prop.value;
    }
    return null;
}

/**
 * Why a caller-classified call site does not refuse before it writes, or null. The
 * FIRST `isOurBlobUrl` in the function is the refusal: it has to sit outside every
 * try and ahead of the writer and of anything else the function writes first.
 */
function callerRefusal(fnNode, row) {
    const guard = callsTo(fnNode, "isOurBlobUrl")[0];
    if (!guard) return "it never asks isOurBlobUrl";
    if (insideTry(fnNode, guard)) return "the refusal sits inside a try, so it leans on a rollback";
    const writes = [row.writer, ...(row.firstWrites || [])];
    for (const name of writes) {
        const first = callsTo(fnNode, name)[0];
        if (!first) return `${name} is named as a write here and not called`;
        if (guard.start > first.start) return `the refusal comes after ${name}`;
    }
    return null;
}

/**
 * Why a server-classified call site is not handing over its own `put()`, or null:
 * the attachment is `[{ url: X.url, … }]`, with `X` bound to `await put(…)` in the
 * same function.
 */
function serverRefusal(fnNode, call) {
    const value = fileArgument(call);
    if (value?.type !== "ArrayExpression" || value.elements.length === 0) return "its file is not an array literal";
    const putBindings = new Set();
    walk(fnNode, (n) => {
        if (
            n.type === "VariableDeclarator" &&
            n.id?.type === "Identifier" &&
            n.init?.type === "AwaitExpression" &&
            calleeName(n.init.argument) === "put"
        ) {
            putBindings.add(n.id.name);
        }
    });
    for (const el of value.elements) {
        const url = el?.type === "ObjectExpression" ? el.properties.find((p) => keyName(p) === "url") : null;
        const v = url?.value;
        const ok =
            v?.type === "MemberExpression" &&
            !v.computed &&
            v.object?.type === "Identifier" &&
            v.property?.name === "url" &&
            putBindings.has(v.object.name);
        if (!ok) return "its url is not `.url` off a put() in the same function";
    }
    return null;
}

/** Every array literal holding an object with a `url` key — an attachment value. */
function urlArrays(ast) {
    const found = [];
    walk(ast, (n) => {
        if (
            n.type === "ArrayExpression" &&
            n.elements.some((el) => el?.type === "ObjectExpression" && el.properties.some((p) => keyName(p) === "url"))
        ) {
            found.push(n);
        }
    });
    return found;
}

/** The literals a file hands its writers, or builds inside one of its own. */
function accountedArrays(ast, declaredWriterNodes) {
    const accounted = new Set();
    for (const { node } of writerCalls(ast)) {
        const value = fileArgument(node);
        if (value) for (const arr of urlArrays(value)) accounted.add(arr);
    }
    for (const fnNode of declaredWriterNodes) {
        for (const arr of urlArrays(fnNode)) accounted.add(arr);
    }
    return accounted;
}

export function run({ check, assert, log }) {
    // ── 1. the predicate ────────────────────────────────────────────────────────
    log("THE PREDICATE — our store and nothing else:");
    check("a url on our store passes", isOurBlobUrl(OUR_URL, TOKEN_ENV), true);
    check("  and passes when OIDC names the store instead", isOurBlobUrl(OUR_URL, OIDC_ENV), true);
    check(
        "  and a store id in capitals reads as its host",
        isOurBlobUrl("https://ABCDEF123.public.blob.vercel-storage.com/q.pdf", TOKEN_ENV),
        true
    );
    // THE #438 MUTANT, first after the positive case: a suffix test passes this.
    check(
        "ANOTHER VERCEL CUSTOMER'S STORE IS REFUSED",
        isOurBlobUrl("https://someoneelse42.public.blob.vercel-storage.com/q.pdf", TOKEN_ENV),
        false
    );
    check(
        "Airtable's own attachment url is refused (#142)",
        isOurBlobUrl("https://v5.airtableusercontent.com/v3/u/57/57/1788372000000/abc/quotation.pdf", TOKEN_ENV),
        false
    );
    check("http on our host is refused", isOurBlobUrl(OUR_URL.replace("https:", "http:"), TOKEN_ENV), false);
    check(
        "a port on our host is refused",
        isOurBlobUrl("https://abcdef123.public.blob.vercel-storage.com:8443/q.pdf", TOKEN_ENV),
        false
    );
    check(
        "credentials in the url are refused",
        isOurBlobUrl("https://u:p@abcdef123.public.blob.vercel-storage.com/q.pdf", TOKEN_ENV),
        false
    );
    check(
        "a look-alike host carrying ours as a prefix is refused",
        isOurBlobUrl("https://abcdef123.public.blob.vercel-storage.com.evil.example/q.pdf", TOKEN_ENV),
        false
    );
    check(
        "a subdomain of our host is refused",
        isOurBlobUrl("https://x.abcdef123.public.blob.vercel-storage.com/q.pdf", TOKEN_ENV),
        false
    );
    check("the cloud metadata address is refused", isOurBlobUrl("https://169.254.169.254/latest/meta-data/", TOKEN_ENV), false);
    check("a malformed url is refused", isOurBlobUrl("not a url", TOKEN_ENV), false);
    check("an empty string is refused", isOurBlobUrl("", TOKEN_ENV), false);
    check("undefined is refused", isOurBlobUrl(undefined, TOKEN_ENV), false);
    // NO VARIABLE, NO STORE. This is what the offline tier itself is, and it is the
    // direction a misconfigured deployment fails in: loudly, every upload refused.
    check("with no store named, our own url is refused", isOurBlobUrl(OUR_URL, {}), false);
    check(
        "  and so it is under a token that is not the SDK's shape",
        isOurBlobUrl(OUR_URL, { BLOB_READ_WRITE_TOKEN: "not-a-blob-token" }),
        false
    );

    log("");
    log("and the writers' backstop:");
    const threw = (fn) => {
        try {
            fn();
            return null;
        } catch (err) {
            return err.message;
        }
    };
    check("our file passes", threw(() => assertOurBlobFiles("t", [{ url: OUR_URL, filename: "q.pdf" }], TOKEN_ENV)), null);
    check("no attachment at all passes", threw(() => assertOurBlobFiles("t", undefined, TOKEN_ENV)), null);
    check("  and an empty one does", threw(() => assertOurBlobFiles("t", [], TOKEN_ENV)), null);
    const foreignMessage = threw(() =>
        assertOurBlobFiles(
            "createInvoice",
            [{ url: OUR_URL }, { url: "https://someoneelse42.public.blob.vercel-storage.com/x.pdf" }],
            TOKEN_ENV
        )
    );
    assert("one file off our store among several throws", foreignMessage !== null);
    assert("  naming the writer that refused", foreignMessage?.startsWith("createInvoice:") === true);
    assert("an entry with no url throws", threw(() => assertOurBlobFiles("t", [{ id: "attXYZ" }], TOKEN_ENV)) !== null);
    assert("a value that is not a list throws", threw(() => assertOurBlobFiles("t", { url: OUR_URL }, TOKEN_ENV)) !== null);

    const appFiles = jsFilesUnder("app");
    const libFiles = jsFilesUnder("lib");
    const allFiles = [...appFiles, ...libFiles];
    const parsed = new Map(allFiles.map((rel) => [rel, parseFile(rel)]));

    log("");
    log("one predicate, spelled once:");
    // In CODE, not in prose: a comment explaining what the suffix used to admit is
    // not a second test of it, and a string literal is where one would live.
    const suffixSpelled = allFiles.filter((rel) => {
        if (rel === "lib/fileSource.js") return false;
        let found = false;
        walk(parsed.get(rel).ast, (n) => {
            const text =
                n.type === "Literal" && typeof n.value === "string"
                    ? n.value
                    : n.type === "TemplateElement"
                      ? n.value?.cooked
                      : null;
            if (text?.includes("blob.vercel-storage.com")) found = true;
        });
        return found;
    });
    check("the store host's suffix is a literal only in lib/fileSource.js", suffixSpelled.join(","), "");
    const definitions = allFiles.filter((rel) => {
        let found = false;
        walk(parsed.get(rel).ast, (n) => {
            if (n.type === "FunctionDeclaration" && n.id?.name === "isOurBlobUrl") found = true;
            if (n.type === "VariableDeclarator" && n.id?.name === "isOurBlobUrl") found = true;
        });
        return found;
    });
    check("isOurBlobUrl is defined in lib/fileSource.js and nowhere else", definitions.join(","), "lib/fileSource.js");
    // The route that fetches a caller's url itself — the SSRF half of the same rule,
    // which verify-authz.mjs checked as text until #438 brought it here as a call.
    const detectPo = parsed.get("app/api/invoices/detect-po/route.js");
    const detectPoHandler = resolveFunction(detectPo.ast, "POST");
    const detectGuard = detectPoHandler ? callsTo(detectPoHandler, "isOurBlobUrl")[0] : null;
    const detectFetch = detectPoHandler ? callsTo(detectPoHandler, "fetch")[0] : null;
    assert(
        "detect-po asks isOurBlobUrl before it fetches the caller's url, outside its try",
        Boolean(detectGuard && detectFetch) &&
            detectGuard.start < detectFetch.start &&
            !insideTry(detectPoHandler, detectGuard)
    );

    // ── 2. the writers ─────────────────────────────────────────────────────────
    log("");
    log("THE WRITERS — every attachment write is in one, and each asks first:");
    const declaredWriterNodes = new Map();
    for (const [rel, entry] of Object.entries(ATTACHMENT_WRITERS)) {
        const { ast } = parsed.get(rel);
        const writes = attachmentWrites(ast);
        const nodes = entry.writers.map((name) => resolveFunction(ast, name));
        declaredWriterNodes.set(rel, nodes.filter(Boolean));
        const stray = writes.filter((w) => !nodes.some((fnNode) => contains(fnNode, w.node)));
        check(
            `${rel} writes \`${entry.field}\` only inside ${entry.writers.join(" and ")}`,
            stray.map((w) => `line ${lineOf(parsed.get(rel).source, w.node)}`).join(","),
            ""
        );
        entry.writers.forEach((name, i) => {
            const reason = writerRefusal(nodes[i], name, writes);
            assert(`  ${name} asks assertOurBlobFiles about what it writes, first${reason ? ` — ${reason}` : ""}`, reason === null);
        });
    }
    const writesElsewhere = [];
    for (const rel of allFiles) {
        if (ATTACHMENT_WRITERS[rel]) continue;
        for (const w of attachmentWrites(parsed.get(rel).ast)) {
            writesElsewhere.push(`${rel}:${lineOf(parsed.get(rel).source, w.node)} (${w.field})`);
        }
    }
    check("no attachment field is written outside the service modules above", writesElsewhere.join(", "), "");
    // ANTI-VACUITY: the write finder has to see the two shapes the writers use and the
    // shape the mutant would take, or "nothing written elsewhere" is a finder finding
    // nothing anywhere.
    const plantedWrite = parseSource(
        'export async function sneak(id, url) { return base("Invoices").update(id, { File: [{ url }] }); }\n' +
            'function stamp(fields, pdf) { fields["PO PDF File"] = pdf; }\n'
    );
    check("the write finder sees an object-literal write and a bracket write", attachmentWrites(plantedWrite.ast).length, 2);
    const plantedWriter = parseSource(
        'export async function createInvoice({ file }) { return base("Invoices").create({ File: file || [] }); }\n'
    );
    assert(
        "a writer that never asks is refused",
        writerRefusal(resolveFunction(plantedWriter.ast, "createInvoice"), "createInvoice", attachmentWrites(plantedWriter.ast)) !== null
    );
    const lateWriter = parseSource(
        'export async function createInvoice({ file }) { const r = await base("Invoices").create({ File: file || [] });\n' +
            '  assertOurBlobFiles("createInvoice", file); return r; }\n'
    );
    assert(
        "  and so is one that asks after it writes",
        writerRefusal(resolveFunction(lateWriter.ast, "createInvoice"), "createInvoice", attachmentWrites(lateWriter.ast)) !== null
    );
    const goodWriter = parseSource(
        'export async function createInvoice({ file }) { assertOurBlobFiles("createInvoice", file);\n' +
            '  return base("Invoices").create({ File: file || [] }); }\n'
    );
    check(
        "  while the shape the writers use passes",
        writerRefusal(resolveFunction(goodWriter.ast, "createInvoice"), "createInvoice", attachmentWrites(goodWriter.ast)),
        null
    );

    // ── 3. the call sites ──────────────────────────────────────────────────────
    log("");
    log("THE CALL SITES — each is a caller's url refused before it writes, or a server's put():");
    const matchedRows = new Set();
    const unclassified = [];
    for (const rel of allFiles) {
        const { ast, source } = parsed.get(rel);
        for (const call of writerCalls(ast)) {
            const rows = FILE_SOURCES.filter(
                (row) => row.file === rel && row.writer === call.writer && contains(resolveFunction(ast, row.fn), call.node)
            );
            if (rows.length !== 1) {
                unclassified.push(`${rel}:${lineOf(source, call.node)} ${call.writer}()`);
                continue;
            }
            const row = rows[0];
            matchedRows.add(row);
            const fnNode = resolveFunction(ast, row.fn);
            const reason = row.source === "caller" ? callerRefusal(fnNode, row) : serverRefusal(fnNode, call.node);
            assert(
                `  ${row.fn} → ${row.writer} (${row.source}: ${row.what})${reason ? ` — ${reason}` : ""}`,
                reason === null
            );
        }
    }
    check("every call of an attachment writer is classified here", unclassified.join(", "), "");
    const stale = FILE_SOURCES.filter((row) => !matchedRows.has(row)).map((row) => `${row.file}#${row.fn}`);
    check("  and every row here still names a call", stale.join(", "), "");
    // ANTI-VACUITY for the three verdicts.
    const plantedAction = parseSource(
        "export async function sneakAction(prevState, formData) {\n" +
            '  const url = formData.get("fileUrl");\n' +
            '  try { await createQuotation({ prRecordId: "recX", file: [{ url }] }); } catch {}\n' +
            "}\n"
    );
    check("the call finder sees a writer call in a source it has not seen", writerCalls(plantedAction.ast).length, 1);
    const plantedRow = { writer: "createQuotation" };
    assert(
        "  and a caller that never asks is refused",
        callerRefusal(resolveFunction(plantedAction.ast, "sneakAction"), plantedRow) !== null
    );
    const refusalInTry = parseSource(
        "export async function lateAction(prevState, formData) {\n" +
            '  const url = formData.get("fileUrl");\n' +
            '  try { if (!isOurBlobUrl(url)) throw new Error("no"); await createQuotation({ file: [{ url }] }); } catch {}\n' +
            "}\n"
    );
    assert(
        "  and so is one whose refusal leans on the try",
        callerRefusal(resolveFunction(refusalInTry.ast, "lateAction"), plantedRow) !== null
    );
    const refusalAfter = parseSource(
        "export async function afterAction(prevState, formData) {\n" +
            '  const url = formData.get("fileUrl"); await createPR({});\n' +
            '  if (!isOurBlobUrl(url)) return { error: "no" }; await createQuotation({ file: [{ url }] });\n' +
            "}\n"
    );
    assert(
        "  and so is one that refuses after something it writes first",
        callerRefusal(resolveFunction(refusalAfter.ast, "afterAction"), { writer: "createQuotation", firstWrites: ["createPR"] }) !==
            null
    );
    const refusalFirst = parseSource(
        "export async function goodAction(prevState, formData) {\n" +
            '  const url = formData.get("fileUrl"); if (!isOurBlobUrl(url)) return { error: "no" };\n' +
            "  try { await createQuotation({ file: [{ url }] }); } catch {}\n" +
            "}\n"
    );
    check(
        "  while the refusals the actions make pass",
        callerRefusal(resolveFunction(refusalFirst.ast, "goodAction"), plantedRow),
        null
    );
    const forgedServer = parseSource(
        "export async function fake(formData) { const blob = await put('x', b, {});\n" +
            '  await createQuotation({ file: [{ url: formData.get("u") }] }); }\n'
    );
    assert(
        "a 'server' call site whose url is not its own put() is refused",
        serverRefusal(resolveFunction(forgedServer.ast, "fake"), writerCalls(forgedServer.ast)[0].node) !== null
    );

    // ── 4. the literal net ──────────────────────────────────────────────────────
    log("");
    log("THE LITERAL NET — every attachment value is built in a writer or handed to one:");
    const unaccounted = [];
    let literalsSeen = 0;
    for (const rel of allFiles) {
        const { ast, source } = parsed.get(rel);
        if (isClientFile(ast)) continue;
        const arrays = urlArrays(ast);
        literalsSeen += arrays.length;
        const accounted = accountedArrays(ast, declaredWriterNodes.get(rel) || []);
        for (const arr of arrays) {
            if (!accounted.has(arr)) unaccounted.push(`${rel}:${lineOf(source, arr)}`);
        }
    }
    check("attachment literals handed to something that is not a declared writer", unaccounted.join(", "), "");
    assert("  and the net found the literals it is about", literalsSeen > 0);
    // ANTI-VACUITY: the net has to be seen catching the one thing part 2 cannot name,
    // a new attachment field with a writer of its own.
    const newField = parseSource(
        "export async function recordPhoto(formData) {\n" +
            '  await createToolPhoto({ toolItemId: "recX", photo: [{ url: formData.get("u") }] });\n' +
            "}\n"
    );
    const newFieldArrays = urlArrays(newField.ast);
    const newFieldAccounted = accountedArrays(newField.ast, []);
    assert(
        "a literal handed to an undeclared writer is caught",
        newFieldArrays.length === 1 && !newFieldAccounted.has(newFieldArrays[0])
    );
}

if (isMain(import.meta.url)) standalone(title, run);
