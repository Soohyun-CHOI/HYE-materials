// Every uploaded file is reached through one route, and each axis through its own
// gate (#331).
//
// TWO FAILURE MODES OF ONE PROPERTY, WHICH IS WHY THEY SHARE A FILE. The property is
// "an uploaded file is served by this app, per record". It comes apart in two
// directions and neither one changes a screen or fails anything else:
//
//   1  THE GATE THAT IS NOT THAT RECORD'S. Five fields reach one export and they sit
//      behind THREE gates. `offline/authz-structure.mjs` lists that export as an
//      exemption, and an exemption proves only that the named helper is called
//      somewhere inside — order is not checked and neither is what else the body
//      does. So `getActiveUser()` plus ONE gate for all five satisfies that check
//      completely: no screen changes, nothing goes red, and a reader opens a packing
//      list for a job they are not on because the handler asked `canViewPR` about a
//      request they happen to be a signer of. That check's own exemption reason says
//      it cannot speak to this and points here.
//   2  A SCREEN THAT STILL LINKS AIRTABLE. Six surfaces move; leave one and that one
//      screen's link keeps dying two to four hours after a render while the other
//      five are fine, which is the failure nobody reports because it looks like a
//      network blip. Caught by enumeration, the shape #292 used for five mail senders
//      and #321 for every URL parameter: an href reading an attachment's `url` must
//      be classified here, and an unclassified one fails.
//
// WHAT THE FIRST ASSERTION RESTS ON, since it is a comparison rather than an
// execution. The route declares each axis's gate in its `AXES` map AND calls a gate
// inside each axis's own opener, in two places on purpose. Neither alone is worth
// anything — a declaration nothing reads is decoration, and a call with nothing to
// compare it against is just a call — so this file reads both off the AST and
// requires them to agree with each other and with the table below. A swapped `gate:`
// disagrees with the opener; a swapped call disagrees with the declaration; one gate
// for all five disagrees with four rows of the table.
//
// WHAT IT STILL CANNOT PROVE, in this tier's standing terms: source shape is not
// execution. A gate call inside `if (false)` satisfies clause 2, and nothing here
// refuses a real request. `scripts/tests/verify-file-route-331.mjs` is where a
// session actually gets a 404, and it has to be run by hand.

import {
    FILE_AXIS,
    FILE_AXIS_LABEL,
    FILE_VIEWER_COPY,
    FILE_RENDER,
    fileHref,
    fileRenderKind,
    fileViewerTitle,
} from "../../../lib/fileLinks.js";
import { calleeName, listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

export const title = "One route serves every uploaded file, per record (#331)";

const ROUTE = "app/api/files/[axis]/[documentId]/[filename]/route.js";
const VIEWER = "app/components/FileViewer.js";
const LINKS = "lib/fileLinks.js";

/**
 * THE DECLARATION. One row per axis: the gate that axis is answered by, and the
 * mapper key its opener may read the attachment from.
 *
 * `attachmentKey` is here rather than the Airtable field name because the key is what
 * the opener actually reads, so a mutation shows up in it — `Purchase Orders` maps
 * `quotationFile` one line above `poPdfFile`, and serving the Lookup instead of the
 * order document is a one-word edit that no field-name declaration would notice.
 */
const AXES = {
    [FILE_AXIS.quotation]: { gate: "canViewPR", attachmentKey: "file" },
    [FILE_AXIS.purchaseOrder]: { gate: "canViewPR", attachmentKey: "poPdfFile" },
    [FILE_AXIS.invoice]: { gate: "getVisibleInvoiceIds", attachmentKey: "file" },
    [FILE_AXIS.delivery]: { gate: "canAccessJobDeliveries", attachmentKey: "packingListFile" },
    [FILE_AXIS.directPurchase]: { gate: "canAccessJobDeliveries", attachmentKey: "file" },
};

/** Every gate any axis may name. An opener calling one not its own is the mutant. */
const EVERY_GATE = [...new Set(Object.values(AXES).map((a) => a.gate))];

/**
 * Every attachment-shaped mapper key in the tables these five axes touch, so an
 * opener reading somebody else's is visible rather than merely undeclared.
 */
const EVERY_ATTACHMENT_KEY = ["file", "poPdfFile", "packingListFile", "quotationFile"];

/**
 * THE HREF INVENTORY. Every place in `app/` whose `href` is an attachment url read
 * off a record or an upload, and which of three things it is.
 *
 * `blob-preview` is not a leftover and not an exemption for work skipped. A file
 * picked in this session has no record for the route to gate on, and the viewer's
 * download control would save it under the random suffix Blob puts in its own
 * `Content-Disposition` — so routing it here would give one control two behaviors.
 * `/invoices/new` is the sharpest case for keeping it: that PDF is the document the
 * reader is transcribing into the form in front of them.
 */
const HREF_SITES = {
    "app/prs/new/PRForm.js": {
        kind: "blob-preview",
        why: "A quotation picked in this session, before any record exists. The entry hydrated from a saved draft is the FileViewer branch beside it, and the two are told apart by whether `file` carries a quotationId.",
    },
    "app/prs/[prId]/EditAndContinueForm.js": {
        kind: "blob-preview",
        why: "New quotations only — an existing one reaches this form as a dropdown option (`existing:<id>`) and is never linked here, so nothing on this screen reads an Airtable url.",
    },
    "app/invoices/new/InvoiceForm.js": {
        kind: "blob-preview",
        why: "The invoice file before the invoice exists. The one place keeping the anchor costs something to lose: the reader is transcribing that PDF into this form.",
    },
};

/** Where the download control lives, and the only place `download` may appear. */
const DOWNLOAD_SITE = VIEWER;

const readRel = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");
const lineOf = (src, offset) => src.slice(0, offset).split("\n").length;

/** The `A.b` of a computed key like `[FILE_AXIS.quotation]`, or null. */
function memberPath(node) {
    if (node?.type !== "MemberExpression" || node.computed) return null;
    if (node.object?.type !== "Identifier" || node.property?.type !== "Identifier") return null;
    return [node.object.name, node.property.name];
}

/** The route's AXES map as { token: { gate, open } }, read off the AST. */
function readAxisMap(ast) {
    const out = {};
    for (const node of ast.body) {
        if (node.type !== "VariableDeclaration") continue;
        for (const d of node.declarations) {
            if (d.id?.name !== "AXES" || d.init?.type !== "ObjectExpression") continue;
            for (const prop of d.init.properties) {
                if (prop.type !== "Property") continue;
                const path = memberPath(prop.key);
                if (!path || path[0] !== "FILE_AXIS") continue;
                const token = FILE_AXIS[path[1]];
                if (!token) continue;
                const entry = { gate: null, open: null };
                if (prop.value?.type === "ObjectExpression") {
                    for (const p of prop.value.properties) {
                        if (p.type !== "Property" || p.key?.type !== "Identifier") continue;
                        if (p.value?.type !== "Identifier") continue;
                        if (p.key.name === "gate") entry.gate = p.value.name;
                        if (p.key.name === "open") entry.open = p.value.name;
                    }
                }
                out[token] = entry;
            }
        }
    }
    return out;
}

/** A top-level `async function name(...)`, by name. */
function functionNamed(ast, name) {
    for (const node of ast.body) {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
        if (decl?.type === "FunctionDeclaration" && decl.id?.name === name) return decl;
    }
    return null;
}

/** Every non-computed property name read anywhere in a subtree. */
function propertiesRead(node) {
    const names = new Set();
    walk(node, (n) => {
        if (n.type === "MemberExpression" && !n.computed && n.property?.type === "Identifier") {
            names.add(n.property.name);
        }
    });
    return names;
}

/** Every identifier the file imports, whatever the source. */
function importedNames(ast) {
    const names = new Set();
    for (const node of ast.body) {
        if (node.type !== "ImportDeclaration") continue;
        for (const s of node.specifiers) names.add(s.local?.name);
    }
    return names;
}

/**
 * Every `href={<member expression ending in .url or a *fileUrl identifier>}` under
 * `app/`, as { rel, line }.
 */
function attachmentHrefs() {
    const found = [];
    const appDir = join(REPO_ROOT, "app");
    for (const abs of listJsFiles(appDir)) {
        const rel = toPosix(relative(REPO_ROOT, abs));
        const { ast, source: src } = parseFile(rel);
        walk(ast, (n) => {
            if (n.type !== "JSXAttribute" || n.name?.name !== "href") return;
            const expr = n.value?.type === "JSXExpressionContainer" ? n.value.expression : null;
            if (!expr) return;
            const isUrlMember =
                expr.type === "MemberExpression" &&
                !expr.computed &&
                expr.property?.type === "Identifier" &&
                expr.property.name === "url";
            const isUrlIdentifier = expr.type === "Identifier" && /fileUrl$/i.test(expr.name);
            if (isUrlMember || isUrlIdentifier) found.push({ rel, line: lineOf(src, n.start) });
        });
    }
    return found.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line);
}

export function run({ check, assert, log }) {
    let ok = true;
    const fail = () => {
        ok = false;
    };

    const { ast: routeAst, source: routeSrc } = parseFile(ROUTE);
    const { ast: viewerAst, source: viewerSrc } = parseFile(VIEWER);

    // --- 1: the axis inventory is closed, and declared in one place --------
    log("");
    log("1  the five axes, and nothing else, reach the route:");

    const declared = Object.keys(AXES).sort();
    const tokens = Object.values(FILE_AXIS).sort();
    if (!check("every axis in lib/fileLinks.js is classified here", tokens.join(","), declared.join(","))) fail();

    const map = readAxisMap(routeAst);
    const mapped = Object.keys(map).sort();
    if (!check("  and the route's own map holds exactly those", mapped.join(","), declared.join(","))) fail();

    // ANTI-VACUITY: an empty read of the map is also what a parse failure, a renamed
    // constant and a changed key shape all report, and every comparison above passes
    // vacuously on two empty lists. So the count is pinned to a literal five and each
    // entry has to have both halves.
    if (!check("the map reader found five entries rather than none", mapped.length, 5)) fail();
    const complete = mapped.filter((t) => map[t].gate && map[t].open);
    if (!check("  each with both a declared gate and an opener", complete.length, 5)) fail();

    const labelled = Object.keys(FILE_AXIS_LABEL).sort();
    if (!check("every axis has a viewer label", labelled.join(","), declared.join(","))) fail();

    // The module has to stay import-free, and that is not style. Five `"use client"`
    // files hold it, so anything it reaches would reach the browser bundle; and this
    // check imports it under plain `node` with no loader, which is also what lets
    // `offline/screen-briefs.mjs` pin the labels above. One import of
    // `lib/airtable/*` at any depth takes both away at once.
    const { ast: linksAst } = parseFile(LINKS);
    const linkImports = linksAst.body.filter((n) => n.type === "ImportDeclaration");
    if (!check(`${LINKS} imports nothing`, linkImports.length, 0)) fail();

    // --- 2: each axis's opener calls its OWN gate, and no other -------------
    log("");
    log("2  the gate an axis declares is the gate its opener calls:");

    const routeImports = importedNames(routeAst);
    for (const gate of EVERY_GATE) {
        if (!assert(`the route imports ${gate}`, routeImports.has(gate))) fail();
    }

    for (const token of declared) {
        const entry = map[token] ?? {};
        const expected = AXES[token].gate;
        if (!check(`${token} declares ${expected}`, entry.gate ?? "(none)", expected)) fail();

        const opener = entry.open ? functionNamed(routeAst, entry.open) : null;
        if (!assert(`  ${token}'s opener ${entry.open} is a function in the route`, Boolean(opener))) {
            fail();
            continue;
        }

        const called = EVERY_GATE.filter((g) => calledIn(opener, g));
        if (!check(`  and calls exactly it`, called.join(",") || "(none)", expected)) fail();

        // The field half. A key nothing declared is as much a finding as the wrong
        // one, which is why this compares against the union rather than a denylist.
        const read = propertiesRead(opener);
        const attachmentKeys = EVERY_ATTACHMENT_KEY.filter((k) => read.has(k));
        if (!check(`  and reads only its own attachment`, attachmentKeys.join(","), AXES[token].attachmentKey)) {
            fail();
        }
    }

    // The handler must go THROUGH the map rather than around it: a gate name called
    // directly in GET is a sixth path with no declaration to compare against.
    const handler = functionNamed(routeAst, "GET");
    if (!assert("the route exports a GET handler", Boolean(handler))) fail();
    if (handler) {
        const inHandler = EVERY_GATE.filter((g) => calledIn(handler, g, { except: /^open[A-Z]/ }));
        if (!check("no gate is called in GET itself", inHandler.join(",") || "none", "none")) fail();
        if (!assert("  and GET calls the opener it looked up", /entry\.open\(/.test(routeSrc))) fail();
    }

    // --- 3: no screen links Airtable, and the inventory says why -----------
    log("");
    log("3  every attachment href is classified:");

    const hrefs = attachmentHrefs();

    // ANTI-VACUITY, and #224's rule that a second path to a number must be a second
    // path: a plain text count of `href={` across app/ has nothing to do with the AST
    // walk above, so a walk that silently stopped finding things fails here.
    const textHrefs = listJsFiles(join(REPO_ROOT, "app")).reduce((n, abs) => {
        const src = readFileSync(abs, "utf8");
        return n + (src.match(/href=\{/g) || []).length;
    }, 0);
    if (!assert(`the scan sees hrefs at all (${textHrefs} by text)`, textHrefs > 20)) fail();
    if (!assert(`  and found attachment hrefs among them (${hrefs.length})`, hrefs.length > 0)) fail();

    const classified = Object.keys(HREF_SITES).sort();
    const seen = [...new Set(hrefs.map((h) => h.rel))].sort();
    if (!check("no unclassified attachment href", seen.join(","), classified.join(","))) fail();

    for (const rel of classified) {
        const entry = HREF_SITES[rel];
        if (!assert(`${rel} is still there to classify`, seen.includes(rel))) fail();
        if (!assert(`  ${rel} has a reason`, Boolean(entry.why && entry.why.length > 40))) fail();
        // A blob preview is a pre-save form, which is a Client Component by
        // construction. This is what stops the class being used to excuse a
        // server-rendered record page that kept its Airtable link.
        if (entry.kind === "blob-preview") {
            if (!assert(`  ${rel} is a client component`, readRel(rel).startsWith('"use client"'))) fail();
        }
    }

    for (const [rel, entry] of Object.entries(HREF_SITES)) {
        if (entry.kind !== "route") continue;
        if (!assert(`${rel} builds its href with fileHref`, readRel(rel).includes("fileHref("))) fail();
    }

    // --- 4: the download attribute exists in exactly one place -------------
    log("");
    log("4  `download` is decided once:");

    // The same mutant as clause 2, on the other axis. Cross-origin the attribute was
    // inert, which is why it could sit unwritten for the life of the app; same-origin
    // it decides whether a click renders in the frame or saves, so one on a trigger
    // would turn a viewer into a download with nothing on screen to say so.
    //
    // COUNTED RATHER THAN LISTED BY FILE, which is the version of this that passed a
    // mutation it should have failed: a `download` added to the viewer's own trigger
    // is a second one in the same file, so a deduplicated list of paths reported the
    // one path it expected and stayed green. Run before the fix rather than reasoned
    // about — the first shape of this assertion is exactly the coverage-shaped
    // nothing `verification.md` warns about.
    const downloadSites = [];
    for (const abs of listJsFiles(join(REPO_ROOT, "app"))) {
        const rel = toPosix(relative(REPO_ROOT, abs));
        const { ast, source } = parseFile(rel);
        walk(ast, (n) => {
            if (n.type === "JSXAttribute" && n.name?.name === "download") {
                downloadSites.push(`${rel}:${lineOf(source, n.start)}`);
            }
        });
    }
    if (!check("exactly one download attribute in app/", downloadSites.length, 1)) fail();
    if (!check("  and it is in the viewer", (downloadSites[0] || "").split(":")[0], DOWNLOAD_SITE)) fail();
    if (!assert("  on an anchor pointed at the route", /fileHref\(/.test(viewerSrc))) fail();

    // --- 5: the viewer's shape, and the states it cannot detect ------------
    log("");
    log("5  the viewer honors the keyboard rule and cannot fail silently:");

    // CLAUDE.md: anything that opens over the page closes on Escape as well as by its
    // opener, and hands focus back to that opener. Ten overlays predate this file and
    // honor none of it; asserting it HERE is what keeps the first compliant one from
    // regressing to the shape beside it.
    if (!assert("the viewer closes on Escape", /"Escape"/.test(viewerSrc))) fail();
    if (!assert("  and returns focus to its opener", /openerRef\.current\?\.focus\(\)/.test(viewerSrc))) fail();
    if (!assert("  and says it is a dialog", /aria-modal/.test(viewerSrc) && /role="dialog"/.test(viewerSrc))) fail();

    // The download control is what makes an undetectable render failure survivable,
    // so it may not sit inside a conditional. Asserted as "no branch stands between
    // the card and it": the copy is referenced once, unguarded.
    const viewerImports = importedNames(viewerAst);
    if (!assert("the viewer renders the shared download copy", viewerImports.has("FILE_VIEWER_COPY"))) fail();
    if (!assert("  and the hint that stands in for a signal it cannot get", /documentHint/.test(viewerSrc))) fail();

    // --- 6: the pure helpers do what the route and the viewer assume -------
    log("");
    log("6  the href and the render kind:");

    if (!check(
        "an href is this app's own path",
        fileHref({ axis: FILE_AXIS.delivery, documentId: "HYE-DL-260821-02", filename: "HYE logo.png" }),
        "/api/files/delivery/HYE-DL-260821-02/HYE%20logo.png"
    )) fail();
    // The filename segment is what puts the document's own name in a browser tab and
    // in a saved file, measured both ways; a space has to survive it as an escape
    // rather than as a space.
    if (!assert("  with the filename encoded rather than dropped", fileHref({
        axis: FILE_AXIS.quotation,
        documentId: "X",
        filename: "a b#c.pdf",
    }).endsWith("/a%20b%23c.pdf"))) fail();
    if (!check("  and a missing filename falls back to the id", fileHref({
        axis: FILE_AXIS.invoice,
        documentId: "HYE-INV-260819-02",
        filename: null,
    }), "/api/files/invoice/HYE-INV-260819-02/HYE-INV-260819-02")) fail();

    if (!check("a png is an image", fileRenderKind("image/png"), FILE_RENDER.image)) fail();
    if (!check("a jpeg is an image", fileRenderKind("image/jpeg"), FILE_RENDER.image)) fail();
    if (!check("a pdf is a document", fileRenderKind("application/pdf"), FILE_RENDER.document)) fail();
    // Unknown rather than document, because a frame is the shape with no failure
    // signal and guessing into it is how a reader gets a blank box.
    if (!check("anything else is unknown", fileRenderKind("text/html"), FILE_RENDER.unknown)) fail();
    if (!check("  including nothing at all", fileRenderKind(undefined), FILE_RENDER.unknown)) fail();

    if (!check(
        "the title names the axis and then the file",
        fileViewerTitle({ axis: FILE_AXIS.purchaseOrder, filename: "HYE-PO-20260821-02.pdf" }),
        "Purchase order PDF · HYE-PO-20260821-02.pdf"
    )) fail();
    if (!check(
        "  and the axis alone when there is no filename",
        fileViewerTitle({ axis: FILE_AXIS.delivery, filename: null }),
        "Packing list photo"
    )) fail();

    // The three sentences are what a reader meets instead of a file, so none may be
    // empty and the two that stand in for a frame must say what to do.
    for (const key of ["documentHint", "imageFailed", "notViewable"]) {
        if (!assert(`${key} says something`, (FILE_VIEWER_COPY[key] || "").length > 20)) fail();
    }
    if (!assert("the document hint names the way out", /download/i.test(FILE_VIEWER_COPY.documentHint))) fail();
    if (!assert("  and so does the refusal to frame a type", /download/i.test(FILE_VIEWER_COPY.notViewable))) fail();

    log("");
    log(`  ${declared.length} axes, ${EVERY_GATE.length} gates, ${hrefs.length} attachment hrefs classified`);
    return ok;
}

/** Calls to `name` inside a subtree, skipping any nested call this test excludes. */
function calledIn(node, name, { except } = {}) {
    let found = false;
    walk(node, (n) => {
        const callee = calleeName(n);
        if (callee === name) found = true;
        if (except && callee && except.test(callee)) found = found || false;
    });
    return found;
}

if (isMain(import.meta.url)) standalone(title, run);
