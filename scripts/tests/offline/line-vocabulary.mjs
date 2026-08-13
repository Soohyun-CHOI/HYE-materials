// `line` names a `Lines` row under a Job, executable (#227).
//
// CLAUDE.md and `naming.md` say a `PO Items` row is an ordered item, an
// `Invoice Items` row an invoice item, a `Delivery Items` row a delivery item.
// #166 settled that vocabulary and left a guard for it — but the guard lived in
// `offline/delivery-status.mjs` and reached only #166's own messages, so
// `ALLOCATION_COPY` kept the word, `DELETE_COPY` acquired it two issues later,
// and every comment in the repository was outside it. A rule enforceable in one
// module and invisible everywhere else is the shape that let this recur, which
// is why #227 swept the codebase and why the guard now sits here.
//
// SCOPE IS `app/` + `lib/`, the boundary us-english.mjs, product-name.mjs and
// formula-escaping.mjs already draw, and it does the same second job: it is what
// lets this check have NO EXEMPTION LIST. The legitimate uses of the word that
// #227 deliberately left standing are citations of earlier wording and
// documentation prose — `docs/notes/deliveries-and-invoices.md` quotes a former
// heading, `scripts/` carries the rest — and all of it is outside this scope.
// This file is under `scripts/`, so it does not scan itself.
//
// TWO ASSERTIONS, BECAUSE COPY AND PROSE FAIL DIFFERENTLY.
//
//   1. COPY CONSTANTS take the bare word. A `*_COPY` object is text a person
//      reads on a screen, and no screen in this app shows a Job's `Lines` row
//      as "line" or talks about a line of text, so the whole word can be
//      barred there with nothing to excuse. `key` and `tone` are exempt by
//      STRUCTURE rather than by list: they are closed vocabularies the UI
//      switches on, never sentences, and `blocked-po-has-no-line` is one.
//
//   2. COMMENTS AND EVERYTHING ELSE take an EXPLICIT PHRASE LIST, us-english's
//      move for the same reason it gives: `\bline\b` alone matches a line of
//      text, a line number, `Line Label`, and reading a PDF line by line, and a
//      check that cries wolf is one people learn to silence. Every phrase below
//      names a child row and can mean nothing else.
//
// WHAT IS DELIBERATELY NOT IN THE LIST: `order line`. It is a real violation
// shape, but `lib/deliveryReconciliation.js` CITES a former heading containing
// it — "recorded against the same order lines" — and a check whose first act is
// to excuse a citation is the shape #171 records rotting. The narrower list
// costs that one shape and buys an empty exemption list.
//
// WHAT THIS CANNOT SEE: a bare `line` in a comment. `every line of an unpaired
// invoice` would pass, and #227 swept ~590 sites of exactly that kind by hand.
// The gap is real and it is the price of assertion 2's precision. What the list
// does cover is the shape a NEW comment reaches for — someone writing about a
// `PO Items` row types `PO line`, not `line`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import { isMain, standalone } from "./_harness.mjs";

export const title = "`line` is a Job's Lines row — copy and prose under app/ + lib/ (#227)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCANNED_DIRS = ["app", "lib"];

// Each phrase names a row of a child table and nothing else. Written out rather
// than derived, for the reason above.
const BANNED = [
    "PO lines?",
    "purchase order lines?",
    "ordered lines?",
    "invoice lines?",
    "delivery lines?",
    "PR lines?",
    "line items?",
    "candidate lines?",
    "bill's lines?",
];
const PHRASE_RE = new RegExp(`\\b(${BANNED.join("|")})\\b`, "gi");

// The bare word, for copy only.
const WORD_RE = /\blines?\b/i;

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(js|jsx|mjs)$/.test(entry)) out.push(full);
    }
    return out;
}

/**
 * Every string a `*_COPY` constant would put on a screen.
 *
 * Walks the declarator's subtree and collects string literals and template
 * chunks, skipping the value of a `key` or `tone` property — those switch the
 * UI and are never read aloud.
 */
export function copyStrings(source) {
    const out = [];
    let ast;
    try {
        ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    } catch {
        return out;
    }

    const visit = (node, copyName, skipping) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "VariableDeclarator" && /_COPY$/.test(node.id?.name ?? "")) {
            copyName = node.id.name;
        }
        if (copyName && !skipping) {
            if (node.type === "Literal" && typeof node.value === "string") {
                out.push({ copyName, text: node.value });
            } else if (node.type === "TemplateElement") {
                out.push({ copyName, text: node.value.cooked ?? "" });
            }
        }
        for (const key of Object.keys(node)) {
            const value = node[key];
            const skipHere =
                node.type === "Property" &&
                key === "value" &&
                (node.key?.name === "key" || node.key?.name === "tone" || node.key?.value === "key");
            if (Array.isArray(value)) {
                for (const child of value) visit(child, copyName, skipping || skipHere);
            } else if (value && typeof value === "object" && value.type) {
                visit(value, copyName, skipping || skipHere);
            }
        }
    };

    visit(ast, null, false);
    return out;
}

export function run({ check, assert, log }) {
    const files = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));
    const sources = new Map(
        files.map((f) => [relative(REPO_ROOT, f).replaceAll("\\", "/"), readFileSync(f, "utf8")])
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // "No violations" and "read nothing" print the same result, so the scan
    // proves it can see and both matchers prove they can match before anything
    // is claimed absent.
    log("anti-vacuity — the scan reaches files, and both matchers fire:");
    assert(`walked ${sources.size} source files under ${SCANNED_DIRS.join("/ + ")}/`, sources.size > 100);

    const allCopy = [...sources.values()].flatMap((s) => copyStrings(s));
    assert(
        `read ${allCopy.length} strings out of *_COPY constants, so the walker resolves`,
        allCopy.length > 50
    );
    // The copy walker must be reading SENTENCES, not just keys: if the skip rule
    // ever swallowed the text, this is what would notice.
    assert(
        "the copy it read contains whole sentences",
        allCopy.some((c) => c.text.split(" ").length > 6)
    );
    // And it must still be skipping keys, or assertion 1 would fire on
    // `blocked-po-has-no-line` and get excused into uselessness.
    assert(
        "a `key` value carrying the word is skipped",
        copyStrings('const A_COPY = { a: () => ({ key: "po-has-no-line", text: "fine" }) };').every(
            (c) => !WORD_RE.test(c.text)
        )
    );

    const plantedCopy = copyStrings('const X_COPY = { body: () => `the 3 purchase order lines it hit` };');
    assert(
        "assertion 1 fires on planted copy",
        plantedCopy.some((c) => WORD_RE.test(c.text))
    );
    const plantedProse = "// the PO line and the invoice lines and one line item";
    const plantedHits = plantedProse.match(PHRASE_RE) || [];
    assert(`assertion 2 fires on a planted comment (${plantedHits.length} phrases)`, plantedHits.length === 3);

    // ── 1: copy constants take the bare word ────────────────────────────────
    log("");
    log("no *_COPY sentence says `line`:");
    const copyOffenders = [];
    for (const [path, src] of sources) {
        for (const { copyName, text } of copyStrings(src)) {
            if (WORD_RE.test(text)) copyOffenders.push(`${path} ${copyName}: ${JSON.stringify(text)}`);
        }
    }
    copyOffenders.slice(0, 10).forEach((o) => log(`    ${o}`));
    check(
        `copy strings naming a row a "line"${copyOffenders.length ? ` (first: ${copyOffenders[0]})` : ""}`,
        copyOffenders.length,
        0
    );

    // ── 2: prose takes the phrase list ──────────────────────────────────────
    log("");
    log("no comment or rendered text names a child row with the old word:");
    const proseOffenders = [];
    for (const [path, src] of sources) {
        src.split("\n").forEach((line, i) => {
            PHRASE_RE.lastIndex = 0;
            let m;
            while ((m = PHRASE_RE.exec(line))) proseOffenders.push(`${path}:${i + 1} "${m[0]}"`);
        });
    }
    proseOffenders.slice(0, 10).forEach((o) => log(`    ${o}`));
    check(
        `banned phrases${proseOffenders.length ? ` (${proseOffenders.length}, first: ${proseOffenders[0]})` : ""}`,
        proseOffenders.length,
        0
    );

    log("");
    log(`${BANNED.length} phrases barred, no exemption list.`);
}

if (isMain(import.meta.url)) standalone(title, run);
