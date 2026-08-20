// One word per thing, executable (#227).
//
// CLAUDE.md and `naming.md` say a concept with an Airtable table behind it takes
// that table's name: a `PO Items` row is an ordered item, an `Invoice Items` row an
// invoice item, a `Deliveries` row a delivery. #166 settled part of that vocabulary
// and left a guard for it — but the guard lived in `offline/delivery-status.mjs` and
// reached only #166's own messages, so `ALLOCATION_COPY` kept the word, `DELETE_COPY`
// acquired it two issues later, and every comment in the repository was outside it. A
// rule enforceable in one module and invisible everywhere else is the shape that let
// this recur, which is why #227 swept the codebase and why the guard now sits here.
//
// WHAT #227 ACTUALLY SWEPT, so the next reader knows what this file is the end of:
// `line` off every child row in prose (#228) and then off the identifiers as well,
// `shipment` off both, `arrival`/`arrived` off both, and `bill` off every NOUN while
// leaving the verb. Four words, four different treatments, one reason — the table
// name wins. The assertions below hold as much of that as a check can.
//
// SCOPE IS `app/` + `lib/` FOR COPY, PLUS `docs/briefs/` FOR PROSE — close to the
// boundary us-english.mjs, product-name.mjs and formula-escaping.mjs draw, and it
// does the same second job: it is what lets this check have NO EXEMPTION LIST. The
// legitimate uses of the word that #227 left standing are lines of rendered text and
// `Lines` rows, and they are what the phrase list is shaped to miss rather than
// excuse. `docs/notes/` and `scripts/` stay out for the reason measured below; this
// file is under `scripts/`, so it does not scan itself.
//
// THE BRIEFS ARE IN BECAUSE THEY ARE WHERE A DESIGNER READS THE WORDS. A screen
// brief quotes the copy and names the distinctions a redesign may not lose, so a
// brief saying `order line` teaches the wrong word to the one reader who has no code
// in front of them. #227 swept the three uses there; the scope costs no exemption
// because after that sweep there are none.
//
// THREE KINDS OF ASSERTION, BECAUSE COPY, PROSE AND IDENTIFIERS FAIL DIFFERENTLY.
//
//   1, 1b, 1c. COPY CONSTANTS take the bare word — `line`, `shipment`, and since
//      #227 `arrival`/`arrived` as well. A `*_COPY` object is text a person reads
//      on a screen, and no screen in this app shows a Job's `Lines` row as "line"
//      or talks about a line of text, so the whole word can be barred there with
//      nothing to excuse. `key` and `tone` are exempt by STRUCTURE rather than by
//      list: they are closed vocabularies the UI switches on, never sentences.
//
//   2. COMMENTS, RENDERED TEXT AND THE BRIEFS take an EXPLICIT PHRASE LIST,
//      us-english's move for the same reason it gives: `\bline\b` alone matches a
//      line of text, a line number, `Line Label`, and reading a PDF line by line,
//      and a check that cries wolf is one people learn to silence. Every phrase
//      below names a child row and can mean nothing else.
//
//   3, 4. THE RULE'S PREMISES rather than its words (#269) — each barred word
//      still loses to a live table, and no ban entry is a bare word.
//
//   5. IDENTIFIERS take a COMPLETE INVENTORY (#227), which is the assertion the
//      other four could not be. See `SURVIVING_IDENTIFIERS`.
//
// `order lines?` IS IN THE LIST NOW, AND WHAT KEPT IT OUT WAS A MISPLACED CITATION.
// This header said the phrase was left off because `lib/deliveryReconciliation.js`
// cited a former heading containing it — "recorded against the same order lines" —
// and that a check whose first act is to excuse a citation is the shape #171 records
// rotting. The reasoning was sound and the FILE was wrong: that module has said
// `recorded against the same ordered item` since #228, and the citation lives in
// `docs/notes/deliveries-and-invoices.md`, which this check does not scan. So the
// phrase costs no exemption and goes on the list — the scope boundary was already
// doing the work the omission was invented for. Two lessons, both #227's: a premise
// naming a file has to name the right one, and the reason to keep `docs/notes/` out
// is now load-bearing rather than merely measured.
//
// WHAT ASSERTION 2 CANNOT SEE: a bare `line` in a comment. `every line of an
// unpaired invoice` would pass, and #228 swept ~590 sites of exactly that kind by
// hand. The gap is real and it is the price of that assertion's precision. What the
// list does cover is the shape a NEW comment reaches for — someone writing about a
// `PO Items` row types `PO line`, not `line`.
//
// THE OTHER HALF OF THAT GAP IS NOW ASSERTION 5, and it closes the direction that
// mattered more. A phrase list cannot look inside a token, so `lineStatus` — the
// identifier that seeded this whole vocabulary — was invisible to every check for
// four issues. An AST can, and the question it asks is not "does this token contain
// a barred word" but "is this the whole set of tokens that still do", which fails on
// a NEW one as well as on a stale entry. What remains genuinely unreachable is prose
// using the bare word for a child row, and nothing here claims otherwise.
//
// ───────────────────────────────────────────────────────────────────────────────
// #269 STATED THE RULE THESE ASSERTIONS SERVE, AND SETTLED THREE THINGS ABOUT THIS
// FILE THAT WERE OPEN. The rule is in CLAUDE.md — a concept with an Airtable table
// behind it takes that table's name — and `docs/notes/naming.md` carries its
// derivation. What follows is measured rather than argued, so the next pass does not
// measure it again.
//
// `docs/notes/` AND `scripts/` STAY OUT, AND #269 MEASURED THAT RATHER THAN
// DECLINING IT. Running the phrase list over them finds 33 uses. THIRTEEN OF THEM ARE
// IN THIS FILE — the ban-list literals, the planted violations below, and the header
// sentences explaining both — so the check would fail on its own source. Two more are
// deliberate citations, and one says so in its own words: `naming.md` spells two
// retired file names without backticks precisely so a later sweep leaves that
// paragraph alone. Widening buys a self-exclusion plus a citation list, which is the
// exemption list the scope boundary exists to avoid. The rest was real prose drift in
// `scripts/tests/`, and #227 swept it by hand where this check cannot see it.
//
// `arrival` HAS JOINED, AND THE FOUR COPY STRINGS THAT BLOCKED IT WERE THE FIRST HALF
// OF THE SAME COMMIT. They were `ALLOCATION_COPY`'s `clear it to record the arrival`,
// `DELETE_COPY`'s `deleting the arrival record` and `record that the material
// arrived`, and `AWAITING_INVOICE_COPY`'s `what these arrivals brought` — the last of
// which is a LOCKED WORD, so `docs/briefs/_shared.md` and `screen-briefs.mjs`'s
// pinned list moved with it. The matcher takes BOTH FORMS, because `arrivals?` reaches
// all but `DELETE_COPY`'s verb and #166 settled the pair together when it chose
// `delivered`. It is copy-only, like `shipment`: the word is legitimate for something
// outside this base — a request arriving, a PR arriving with its prices settled — so
// prose keeps it and only a screen may not.
//
// `bill` can NEVER join: of 422 strings walked out of `*_COPY` constants, 26 carry the
// word and every one of them is the VERB, which is correct English with no table
// competing for it — `this invoice bills more than the delivery matched to it
// delivered`. The seven NOUNS that stood beside them are reworded (#227) and no
// expression separates the two, since the noun appears bare as `a bill`. So the WORD
// stays unbarred and its identifiers are accounted for by name in assertion 5, where
// `billed` and its family carry "the verb" as their reason. That division — a lexical
// matcher for the words a screen may not use, a named inventory for the tokens — is
// what #269 meant by "this rule cannot live in a test": no single matcher can hold
// it, but two can hold most of it between them.
//
// SO THE TWO ASSERTIONS #269 ADDED CHECK THE RULE'S PREMISES RATHER THAN ITS WORDS.
// Prose cannot be pinned, but a premise can: assertion 3 holds each barred word to
// the TABLE whose name beats it, and assertion 4 holds the prose list to the shape
// that makes it precise. Both were RUN against a mutation rather than asserted to
// work. Renaming `TABLES.DELIVERIES` to `Shipments` fails assertion 3 and its
// anti-vacuity together; adding a bare `lines?` to the list below fails assertion 4
// and turns assertion 2 into 506 hits, which is the crying-wolf outcome this file
// argues about two paragraphs up, now demonstrated rather than described.
//
// THE ASSERTION THAT WAS CONSIDERED AND REJECTED: "no barred word is a table name".
// It is false by design. `Lines` IS a table and the bare word is barred in COPY
// anyway, because no screen in this app shows a `Lines` row — a fact about screens,
// which this tier cannot reach. Encoding it would mean one hard-coded exception,
// which is the shape the paragraph above declines for the scope.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
// Aliased: this file already has a `walk` for directories, and the AST helper's is
// a different traversal over a different thing.
import { parseFile, walk as walkAst } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title =
    "One word per thing: copy, prose and identifiers under app/ + lib/, prose in the briefs (#227, #231, #269)";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
// Copy lives in `lib/` and `app/`; the phrase list also reads the briefs, which are
// prose about those screens. See the header on why the split rather than one scope.
const SCANNED_DIRS = ["app", "lib"];
const PROSE_DIRS = [...SCANNED_DIRS, "docs/briefs"];

// Each phrase names a row of a child table and nothing else. Written out rather
// than derived, for the reason above.
const BANNED = [
    "PO lines?",
    "purchase order lines?",
    "order lines?",
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

/**
 * Which table's name beats each word this file bars (#269).
 *
 * THIS IS THE RULE'S PREMISE, MADE BREAKABLE. CLAUDE.md bars `shipment` because
 * `Deliveries` exists and `line` for a child row because `Lines` does; if either
 * table were renamed the ban would still be enforced while its justification had
 * quietly gone. Renaming a table on this base is cheap and encouraged, so this is a
 * premise that really can lapse — and whoever renames one now has to come back
 * through the vocabulary.
 *
 * The right-hand side is the table's name exactly as `TABLES` spells it, since that
 * is what is compared. `bill` is deliberately absent: it is barred nowhere, and a map
 * entry for a word no assertion uses would claim coverage this file does not have.
 *
 * `arrival` IS HERE BECAUSE #227 REWORDED THE FOUR COPY STRINGS THAT BLOCKED IT, in
 * the commit that added this entry. `Deliveries` beats it exactly as it beats
 * `shipment` — one table, one word for its rows — and the two are barred by two
 * matchers rather than one because they are two spellings of the same mistake and a
 * failure should name which one it found.
 */
const BEATEN_BY_TABLE = {
    // These keys are the BARRED WORDS THEMSELVES, not names of anything — so an
    // identifier sweep must leave them alone. #227's own sweep renamed `arrival`
    // here to `delivery` and assertion 3's coverage check caught it in the same run,
    // which is the property that assertion exists for.
    shipment: "Deliveries",
    arrival: "Deliveries",
    line: "Lines",
};

/**
 * The table names, PARSED rather than imported.
 *
 * `lib/airtable/client.js` throws at module load without `AIRTABLE_API_KEY`, which
 * is what puts anything importing it in the credentialed tier — so this reads the
 * object literal out of the source instead. Returns [] on a parse failure or a
 * missing declaration, which the anti-vacuity assertion below is what catches.
 */
export function tableNamesFromSource(relPath = "lib/airtable/client.js") {
    const names = [];
    let ast;
    try {
        ({ ast } = parseFile(relPath));
    } catch {
        return names;
    }
    walkAst(ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "TABLES" || node.init?.type !== "ObjectExpression") return;
        for (const prop of node.init.properties) {
            if (prop.value?.type === "Literal" && typeof prop.value.value === "string") {
                names.push(prop.value.value);
            }
        }
    });
    return names;
}

/**
 * Is this prose ban entry qualified — does it name something besides the word?
 *
 * Assertion 2's precision rests on every entry naming a child row and nothing else,
 * which the header argues and this makes executable: a bare `lines?` would match a
 * line of text, a line number and `Line Label`, and a check that cries wolf is one
 * people learn to silence. Stripping the word leaves the qualifier; an entry with
 * nothing left is bare.
 *
 * NO TRAILING `\b`, WHICH IS THE ONE SUBTLETY. An entry is a regex FRAGMENT, so the
 * word arrives as `lines?` — and `?` is not a word character, so a boundary after it
 * never matches and a bare entry would have read as qualified. The leading `\b`
 * stays, so a word merely ending in `line` keeps its qualifier.
 */
export function isQualified(entry) {
    return entry.replace(/\blines?\??/gi, "").trim().length > 0;
}

/**
 * EVERY IDENTIFIER UNDER `app/` + `lib/` THAT STILL CARRIES ONE OF THE FOUR STEMS,
 * WITH THE REASON IT SURVIVES (#227).
 *
 * A COMPLETE INVENTORY RATHER THAN AN EXEMPTION LIST, and the difference is what
 * makes it worth having. An exemption list answers "may this stay" and grows
 * quietly; this answers "is this the whole set", so it fails in BOTH directions —
 * a new `line` identifier is red, and so is one that was renamed without being
 * taken off the list. That is the only thing standing between #227's sweep and a
 * slow refill, because assertion 2's phrase list cannot see inside a token:
 * `orderedItemStatus` was `lineStatus` and no word boundary would ever have found
 * it.
 *
 * THE REASON STRING IS THE POINT, not decoration. Without it this is a snapshot of
 * whatever the code happened to say on the day it was written, and the next reader
 * cannot tell a survivor from an oversight. Each one says which of the three
 * legitimate senses the name is in: a `Lines` row, a line of text, or a word that
 * merely contains the letters. `billed` and its family are the fourth sense — the
 * VERB, which no table competes for.
 *
 * SCOPE IS `app/` + `lib/` for the reason the header gives: this file lives under
 * `scripts/`, whose own fixtures and ban-list literals would otherwise have to be
 * excused one by one.
 */
const SURVIVING_IDENTIFIERS = {
    // A `Lines` row under a Job, or the table itself.
    LINES: "the Lines table in TABLES",
    Line: "the `Line` link field on Purchase Requests",
    LineForm: "the component that creates a Lines row",
    NewLinePage: "the page that renders it",
    renderNewLinePage: "its labeled inner render",
    createLine: "writes a Lines row",
    createLineAction: "the Server Action that calls it",
    getAllLines: "reads Lines rows",
    getPRsByLine: "PRs under one Lines row",
    line: "a Lines row (PR paths), or a line of text in poPdf.js",
    lines: "Lines rows, or lines of text in airtableOps.js",
    lineId: "a Lines record id on the PR paths",
    lineIds: "Lines record ids, from a Job's own link array",
    lineRecords: "the Lines rows those ids resolve to",
    lineRecordId: "one Lines record id",
    lineLabel: "the Lines primary field",
    lineName: "the Lines human-entered field",
    lineById: "Lines rows keyed by record id",
    linesById: "the same, plural",
    linesByPO: "the Lines row behind each PO",
    linesForJob: "the Lines rows of one Job",
    jobByLineId: "Job record id per Lines row",
    setLineId: "the form state setter for the picked Lines row",
    // A line of rendered or written text.
    termLine: "a line of text in the PO PDF's terms block",
    lineHeight: "the CSS property",
    formatScopeLine: "one line of the ops log",
    formatRepeatedLine: "the same, for a repeated scope",
    // Words that merely contain the letters.
    line1: "the Addresses field `Line 1`",
    line2: "the Addresses field `Line 2`",
    polyline: "the SVG element",
    strokeLinecap: "the SVG attribute",
    strokeLinejoin: "the SVG attribute",
    // The verb, which `Invoices` does not compete for (#269).
    billed: "the verb: what an invoice did",
    billedBeyondOrder: "the verb, scoped to the order",
    billedNotDelivered: "the verb, against the delivery",
    deliveredNotBilled: "its mirror",
    billedByPair: "billed quantity per delivery-and-ordered-item pair",
    billedItemsByOrder: "an invoice's items grouped by the order they bill",
    orderedItemsBilled: "the ordered items one invoice bills",
    anyBilled: "whether anything on the order is billed",
};

// #231 — likewise for the third name of one fact. Copy only, and with no phrase
// list, because unlike `line` this word collides with nothing: every use of it
// on a screen is a `Deliveries` row under another name.
const SHIPMENT_RE = /\bshipments?\b/i;

// The four stems, for the identifier inventory. Deliberately unanchored and
// case-insensitive: an identifier is one token, so `orderedItemStatus` has to be
// caught by the letters rather than by a word boundary.
const STEM_RE = /line|shipment|arriv|bill/i;

// #227 — the fourth name, and the pair #166 settled together. Both forms, or
// `DELETE_COPY`'s verb walks: see the header.
const ARRIVAL_RE = /\barriv(?:al|als|ed|es|e|ing)\b/i;

function walk(dir, out = [], pattern = /\.(js|jsx|mjs)$/) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out, pattern);
        else if (pattern.test(entry)) out.push(full);
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
    // The prose scan adds the briefs, which are `.md` and hold no copy constants —
    // so they are a second map rather than a wider first one.
    const proseSources = new Map([
        ...sources,
        ...walk(join(REPO_ROOT, "docs/briefs"), [], /\.md$/).map((f) => [
            relative(REPO_ROOT, f).replaceAll("\\", "/"),
            readFileSync(f, "utf8"),
        ]),
    ]);

    // ── anti-vacuity ────────────────────────────────────────────────────────
    // "No violations" and "read nothing" print the same result, so the scan
    // proves it can see and every matcher proves it can match before anything
    // is claimed absent.
    log("anti-vacuity — the scan reaches files, and every matcher fires:");
    assert(`walked ${sources.size} source files under ${SCANNED_DIRS.join("/ + ")}/`, sources.size > 100);
    // And the prose scan reaches the briefs, or widening the scope bought nothing.
    assert(
        `and ${proseSources.size - sources.size} briefs under docs/briefs/`,
        proseSources.size - sources.size > 15 &&
            [...proseSources.keys()].includes("docs/briefs/invoices-invoiceId.md")
    );

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
    // `blocked-po-has-no-ordered-item`'s neighbours and get excused into
    // uselessness. The planted key is the shape a copy key really has — #227
    // renamed the live one off the word, so this fixture is now the only place
    // the old spelling survives, and it is a fixture rather than a claim.
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
    const plantedShipment = copyStrings('const X_COPY = { body: () => `the shipment it names` };');
    assert(
        "assertion 1b fires on planted copy, and 1 does not — the two matchers are separate",
        plantedShipment.some((c) => SHIPMENT_RE.test(c.text)) &&
            !plantedShipment.some((c) => WORD_RE.test(c.text))
    );
    const plantedArrival = copyStrings('const X_COPY = { body: () => `what these arrivals brought` };');
    const plantedArrived = copyStrings('const X_COPY = { body: () => `the material arrived` };');
    assert(
        "assertion 1c fires on both forms, and neither 1 nor 1b does",
        plantedArrival.some((c) => ARRIVAL_RE.test(c.text)) &&
            plantedArrived.some((c) => ARRIVAL_RE.test(c.text)) &&
            ![...plantedArrival, ...plantedArrived].some(
                (c) => WORD_RE.test(c.text) || SHIPMENT_RE.test(c.text)
            )
    );
    const plantedProse = "// the PO line and the invoice lines and one order line";
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

    // ── 1b: and no *_COPY sentence says `shipment` (#231) ───────────────────
    // THE SAME RULE AS #166's `arrived`, ONE WORD LATER. The table is
    // `Deliveries`, the rollup is `Delivered Qty`, and the screens say
    // `delivered` — so a sentence calling the same record a `shipment` makes a
    // reader ask what the difference is, and there is none.
    //
    // COPY ONLY, WHICH IS NOT WHERE MOST OF THE WORD IS. #231 counted 322 uses
    // across the repository and exactly two were sentences a person reads; the
    // rest is comment and documentation prose, where the word is a synonym
    // rather than a collision and where at least one use is legitimate —
    // `lib/airtable/invoices.js` says `partial shipments` about a vendor
    // shipping in parts, which is the commercial act and not a `Deliveries`
    // row. Sweeping prose needs sentences rewritten one at a time and is its
    // own issue; the two screen strings were #166's rule broken outright, so
    // they are fixed and pinned here.
    //
    // IT SHARES ASSERTION 1's WALKER RATHER THAN GETTING A FILE, because this
    // file is the one that already answers "which words may a copy constant
    // not use", and two files walking the same strings to bar one word each
    // would be two implementations of one sweep. The FILENAME stays #227's:
    // that issue is open, and renaming its check from another issue would put
    // its remaining work in a file named for neither.
    log("");
    log("no *_COPY sentence says `shipment`:");
    const shipmentOffenders = [];
    for (const [path, src] of sources) {
        for (const { copyName, text } of copyStrings(src)) {
            if (SHIPMENT_RE.test(text)) {
                shipmentOffenders.push(`${path} ${copyName}: ${JSON.stringify(text)}`);
            }
        }
    }
    shipmentOffenders.slice(0, 10).forEach((o) => log(`    ${o}`));
    check(
        `copy strings calling a delivery a "delivery"${
            shipmentOffenders.length ? ` (first: ${shipmentOffenders[0]})` : ""
        }`,
        shipmentOffenders.length,
        0
    );

    // ── 1c: and no *_COPY sentence says `arrival` or `arrived` (#227) ───────
    // THE PAIR #166 CHOSE `delivered` OVER, barred on the screens four issues
    // later. Copy only, like `shipment` and for a sharper reason: outside a
    // screen the word has honest work — a request arrives, a query result
    // arrives, a PR arrives with its prices already settled — and none of those
    // is a `Deliveries` row. A screen has no such use, so there the whole word
    // goes.
    log("");
    log("no *_COPY sentence says `arrival` or `arrived`:");
    const arrivalOffenders = [];
    for (const [path, src] of sources) {
        for (const { copyName, text } of copyStrings(src)) {
            if (ARRIVAL_RE.test(text)) {
                arrivalOffenders.push(`${path} ${copyName}: ${JSON.stringify(text)}`);
            }
        }
    }
    arrivalOffenders.slice(0, 10).forEach((o) => log(`    ${o}`));
    check(
        `copy strings calling a delivery an "delivery"${
            arrivalOffenders.length ? ` (first: ${arrivalOffenders[0]})` : ""
        }`,
        arrivalOffenders.length,
        0
    );

    // ── 2: prose takes the phrase list ──────────────────────────────────────
    log("");
    log("no comment, rendered text or brief names a child row with the old word:");
    const proseOffenders = [];
    for (const [path, src] of proseSources) {
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

    // ── 3: the rule's premise — a table still carries the winning word ──────
    // #269. Prose cannot be pinned; the fact it rests on can. Each word barred
    // above loses to a table's name, and this asserts that table is still there.
    log("");
    log("every barred word loses to a table that still exists:");
    const tables = tableNamesFromSource();
    // ANTI-VACUITY, and it needs both halves: an empty parse and a clean base read
    // the same way, and a parse that returned every string literal in the file would
    // satisfy any lookup below.
    assert(`parsed ${tables.length} names out of TABLES without importing it`, tables.length >= 20);
    assert(
        "the parse resolves real names and not any string it passed",
        tables.includes("Deliveries") && tables.includes("Lines") && !tables.includes("Shipments")
    );
    const orphaned = Object.entries(BEATEN_BY_TABLE)
        .filter(([, table]) => !tables.includes(table))
        .map(([word, table]) => `${word} → ${table}`);
    check(
        `no barred word whose winning table is gone${orphaned.length ? ` (${orphaned.join(", ")})` : ""}`,
        orphaned.length === 0 ? "none" : orphaned.join(", "),
        "none"
    );
    // And the map has to cover what is actually barred, or a word could be added to
    // a matcher above and never acquire a premise here.
    check(
        "every matcher's word carries a premise",
        Object.keys(BEATEN_BY_TABLE).sort().join(),
        "arrival,line,shipment"
    );

    // ── 4: the prose list stays qualified ───────────────────────────────────
    // #269. What keeps assertion 2 trusted is that no entry is a bare word, which
    // the header argues at length and nothing enforced.
    log("");
    log("no prose ban entry is a bare word:");
    assert("a planted bare entry is refused", !isQualified("lines?") && !isQualified("line"));
    assert("and a qualified one is not", isQualified("PO lines?") && isQualified("line items?"));
    const bareEntries = BANNED.filter((e) => !isQualified(e));
    check(
        `bare entries in the phrase list${bareEntries.length ? ` (${bareEntries.join(", ")})` : ""}`,
        bareEntries.length,
        0
    );

    // ── 5: the identifier inventory is complete, both ways (#227) ───────────
    // The gap assertion 2 admits to, closed from the other side. A phrase list
    // cannot see inside `orderedItemStatus`; an AST can, so the question becomes
    // "is this the whole set of survivors" rather than "does this token contain a
    // word", and it is asked in both directions.
    log("");
    log("every identifier carrying one of the four stems is a known survivor:");
    const found = new Map();
    for (const path of sources.keys()) {
        const { ast } = parseFile(path);
        walkAst(ast, (node) => {
            if (node.type !== "Identifier" && node.type !== "JSXIdentifier") return;
            if (!STEM_RE.test(node.name)) return;
            if (!found.has(node.name)) found.set(node.name, new Set());
            found.get(node.name).add(path);
        });
    }
    // ANTI-VACUITY, three ways: the walk has to reach identifiers at all, it has to
    // see one this sweep RENAMED (so it is reading the new tree), and it has to
    // reject a name that was never there.
    assert(`walked ${found.size} distinct stem-carrying identifier names`, found.size > 20);
    assert("  including one the sweep left standing", found.has("getAllLines"));
    assert("  and one the sweep renamed is gone", !found.has("lineStatus") && !found.has("poLine"));
    assert("  and a name nobody ever wrote is absent", !found.has("shipmentStatus"));
    assert(
        "the stem matcher sees inside a token, which is what assertion 2 cannot",
        STEM_RE.test("orderedItemStatus") === false && STEM_RE.test("lineStatus")
    );

    const unlisted = [...found.keys()].filter((n) => !SURVIVING_IDENTIFIERS[n]).sort();
    check(
        `identifiers carrying a barred stem with no recorded reason${
            unlisted.length ? ` (${unlisted.join(", ")})` : ""
        }`,
        unlisted.length === 0 ? "none" : unlisted.join(", "),
        "none"
    );
    // The other direction, which is what makes this an inventory rather than an
    // exemption list: a name that has gone must come off, or the list slowly
    // becomes a record of what the code USED to say.
    const stale = Object.keys(SURVIVING_IDENTIFIERS)
        .filter((n) => !found.has(n))
        .sort();
    check(
        `recorded survivors that no longer exist${stale.length ? ` (${stale.join(", ")})` : ""}`,
        stale.length === 0 ? "none" : stale.join(", "),
        "none"
    );
    // And every entry has to SAY something. A blank reason turns the inventory back
    // into a snapshot, which is the failure this whole assertion is against.
    const unexplained = Object.entries(SURVIVING_IDENTIFIERS)
        .filter(([, why]) => typeof why !== "string" || why.trim().length < 8)
        .map(([n]) => n);
    check(
        `survivors with no reason given${unexplained.length ? ` (${unexplained.join(", ")})` : ""}`,
        unexplained.length,
        0
    );

    log("");
    log(
        `${BANNED.length} phrases barred, ${Object.keys(SURVIVING_IDENTIFIERS).length} identifiers ` +
            `accounted for, no exemption list.`
    );
}

if (isMain(import.meta.url)) standalone(title, run);
