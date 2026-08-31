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
// #280 THEN RENAMED THE TABLE THIS FILE'S FIRST WORD LOST TO, WHICH IS THE ONE
// EVENT `BEATEN_BY_TABLE` WAS BUILT TO SURVIVE. `Lines` is `Disciplines`, so a
// `Lines` row no longer exists and `line` no longer loses to a table. The bars stay
// and the PREMISE MOVED: what keeps `PO lines?` and `line items?` off a screen is
// #303's rule that each item table's row takes its own table's name, so `line` sits
// in `BEATEN_BY_RULE` below and is held to a sentence in CLAUDE.md rather than to a
// table in `TABLES`. Dropping the bars instead was the alternative and it was
// rejected on evidence: #278 shipped `already on another line of this invoice`, and
// the phrase list is the only thing that catches that shape returning.
//
// AND THE SWEEP'S OWN PROOF IS ASSERTION 5. Every identifier that meant a `Lines`
// row is gone — 21 of them — and the 21 `discipline*` names that replaced them are
// in the inventory below for the reason `polyline` is: `discipline` CONTAINS the
// letters and carries none of the word. `STEM_RE` is unanchored on purpose, so this
// is the class the inventory has always absorbed rather than a new kind of entry.
//
// #274 TOOK THE VERB, AND THE FOURTH WORD IS NOW LIKE THE OTHER THREE. What
// What #227 left standing was `bill` as what an invoice DOES, on the ground that
// `Invoices` gives no verb — but the derivations already built on that table's name
// were the choice, not free ground: `Invoiced Qty` and `Uninvoiced Items` on the
// base, `uninvoicedQty` in lib/poItemQty.js, and the chip #235 moved from `Billed`
// to `Invoiced`. So the act had two spellings and only one had ever been decided.
// #227's own test settles it — a verb survives only where no verb is already settled
// for the same act, which is why `arrived` went for `delivered`.
//
// SCOPE IS `app/` + `lib/` FOR COPY, PLUS `docs/briefs/` FOR PROSE — close to the
// boundary us-english.mjs, product-name.mjs and formula-escaping.mjs draw, and it
// does the same second job: it is what lets this check have NO EXEMPTION LIST. The
// legitimate uses of the word that #227 left standing are lines of rendered text and
// `Addresses."Line 1"`, and they are what the phrase list is shaped to miss rather
// than excuse. A `Lines` row was the third until #280 renamed the table. `docs/notes/` and `scripts/` stay out for the reason measured below; this
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
//   1, 1b, 1c, 1d. COPY CONSTANTS take the bare word — `line`, `shipment`, since
//      #227 `arrival`/`arrived`, and since #274 `bill` as well. A `*_COPY` object is
//      text a person reads on a screen, and no screen in this app shows a Job's
//      `Lines` row as "line" or talks about a line of text, so the whole word can be
//      barred there with nothing to excuse. `key` and `tone` are exempt by STRUCTURE
//      rather than by list: they are closed vocabularies the UI switches on, never
//      sentences — and that exemption has a cost, spelled out below.
//
//   2. COMMENTS, RENDERED TEXT AND THE BRIEFS take an EXPLICIT PHRASE LIST,
//      us-english's move for the same reason it gives: `\bline\b` alone matches a
//      line of text, a line number, `Line Label`, and reading a PDF line by line,
//      and a check that cries wolf is one people learn to silence. Every phrase
//      below names a child row and can mean nothing else.
//
//   3, 4. THE RULE'S PREMISES rather than its words (#269) — each barred word
//      still loses to something that still exists, and no ban entry is a bare word.
//      Three lose to a live table; since #280 `line` loses to a rule instead, and
//      the rule is checked by reading CLAUDE.md for the sentence that states it.
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
// `bill` HAS JOINED (#274), AND THE MEASUREMENT THAT KEPT IT OUT IS WHAT CHANGED
// RATHER THAN THE ARGUMENT. This paragraph said the word could never be barred: of
// 422 strings walked out of `*_COPY` constants, 26 carried it and every one was the
// VERB, correct English with no table competing for it — and no expression separates
// the verb from the noun, since the noun appears bare as `a bill`. Both halves were
// true. What #274 changed is that the verb has somewhere to go, so the count is now
// 0 of 446 and the whole word is barrable exactly as `arrival` became barrable once
// its four strings were reworded. Two verbs took the 23 sites, and which one applies
// is not a preference: the PARTICIPLE and every quantity are `invoiced`, matching
// `Invoiced Qty` and the `Invoiced` chip, and the TRANSITIVE verb is `charges`,
// matching `No invoice charges this order yet.` — which was already on a screen and
// already pinned. `invoices` as a transitive verb is barred by neither and reads
// badly enough that #227 proved it: it rewrote `each bill ordered items` to `each
// invoice ordered items` and `both bill an ordered item` to `both invoice an ordered
// item`, two sentences that garden-path into a noun phrase and that #274 fixed.
//
// COPY ONLY, LIKE `shipment` AND `arrival`, AND FOR A SHARPER REASON THAN EITHER.
// Three classes of prose keep the word legitimately, so a phrase entry would buy the
// exemption list this file exists without: Airtable's own billing (`airtableOps.js`
// calls its counts a floor of the billed total), `Bill To:` on a vendor's document,
// and citations of words this repo REJECTED — `Over-billed` in lib/variance.js,
// `Billed` / `Partly billed` as the chip set #235 turned down. A screen has no such
// use, so there the whole word goes.
//
// WHAT THE `key` EXEMPTION COSTS, and #274 paid it: a closed vocabulary the UI
// switches on is INVISIBLE TO BOTH MATCHERS. `copyStrings` skips a `key` property's
// value by structure, and assertion 5 visits Identifier nodes, so a string literal is
// no identifier — which left `billed-more`, `order-billed`, `billed-short` and
// `billed-over` unseen by everything here. They were renamed with the rest, and what
// catches a NEW one is not this file: it is the value pins in
// `offline/delivery-status.mjs`, `offline/invoice-order-breakdown.mjs` and
// `offline/overage.mjs`, each of which asserts a key by its literal. So a barred word
// put into a `key` today fails there or nowhere.
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
import { parseFile, repoPath, walk as walkAst } from "./_ast.mjs";
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
    // #272 — THE FORM THAT GOT PAST THIS LIST, and it got past it by putting the
    // possessive the other way round: #278 shipped `already on another line of this
    // invoice` on `/invoices/new`, which `invoice lines?` above does not match. It is
    // as narrow as `bill's lines?` beside it and for the same reason — the entry
    // records a phrasing that actually occurred rather than guessing at the next one.
    // What no phrase can reach is the bare `this line` for an `Invoice Items` row;
    // that is the rule's uncheckable half, which is why CLAUDE.md carries it.
    "lines? of (this|the) invoice",
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
 * is what is compared.
 *
 * `arrival` IS HERE BECAUSE #227 REWORDED THE FOUR COPY STRINGS THAT BLOCKED IT, in
 * the commit that added this entry. `Deliveries` beats it exactly as it beats
 * `shipment` — one table, one word for its rows — and the two are barred by two
 * matchers rather than one because they are two spellings of the same mistake and a
 * failure should name which one it found.
 *
 * `bill` IS HERE FOR THE SAME REASON ONE ISSUE LATER (#274), and this entry replaces a
 * paragraph explaining why the word could have none: it was barred nowhere, so a
 * premise for it would have claimed coverage this file did not have. `Invoices` beats
 * it — but note what the table settles and what it does not. It settles the NOUN, so
 * a row of it is an invoice; the verb is settled by the derivations already built on
 * the name, which is the clause #274 added to CLAUDE.md and which no map can hold.
 */
const BEATEN_BY_TABLE = {
    // These keys are the BARRED WORDS THEMSELVES, not names of anything — so an
    // identifier sweep must leave them alone. #227's own sweep renamed `arrival`
    // here to `delivery` and assertion 3's coverage check caught it in the same run,
    // which is the property that assertion exists for.
    shipment: "Deliveries",
    arrival: "Deliveries",
    bill: "Invoices",
};

/**
 * The barred word whose premise is a RULE rather than a table (#280).
 *
 * THIS ENTRY EXISTS BECAUSE THE PREMISE ABOVE LAPSED EXACTLY AS ITS OWN DOCSTRING
 * SAID IT COULD. `line` lost to `Lines`; #280 renamed that table to `Disciplines`,
 * so the word is no longer spent by a table and `BEATEN_BY_TABLE` could not hold it
 * without claiming something false — `Disciplines` does not beat `line`, and
 * a `Disciplines` row is a discipline.
 *
 * WHAT BARS IT NOW IS #303's RULE: each of the four item tables' rows takes its own
 * table's name in the singular, so an ordered item is not a line and neither is an
 * invoice item, a requested item or a delivery item. That is a positive rule rather
 * than a table, and it is why the phrase list below survives the rename intact.
 *
 * THE VALUE IS THE SENTENCE TO LOOK FOR IN CLAUDE.md, so this premise can lapse the
 * way the other three can. If that rule is ever dropped or reworded out of the file
 * every session reads, assertion 3 says so instead of going quiet — which is the
 * whole property `BEATEN_BY_TABLE` was built for and the reason this is a second map
 * rather than an exemption.
 */
const BEATEN_BY_RULE = {
    line: "ROW TAKES ITS OWN TABLE'S NAME IN THE SINGULAR",
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
 * merely contains the letters.
 *
 * THERE WAS A FOURTH SENSE AND IT IS GONE (#274). Ten entries stood here for `billed`
 * and its family, each reading "the verb, which `Invoices` does not compete for" —
 * and the sense was real while nothing else claimed the act. `Invoiced Qty` did claim
 * it, so the ten are renamed and the list is three senses again. That the shrink is a
 * sweep rather than a stem quietly dropped out of `STEM_RE` is what the two new
 * anti-vacuity lines below assert.
 *
 * SCOPE IS `app/` + `lib/` for the reason the header gives: this file lives under
 * `scripts/`, whose own fixtures and ban-list literals would otherwise have to be
 * excused one by one.
 */
const SURVIVING_IDENTIFIERS = {
    // A line of rendered or written text.
    line: "the `<line>` SVG element, or a line of text in poPdf.js",
    lines: "lines of text in airtableOps.js",
    termLine: "a line of text in the PO PDF's terms block",
    lineHeight: "the CSS property",
    formatScopeLine: "one line of the ops log",
    formatRepeatedLine: "the same, for a repeated scope",
    // Words that merely contain the letters.
    //
    // THE `discipline*` FAMILY IS THIS CLASS AND NOT A NEW ONE (#280). `STEM_RE` is
    // unanchored so it can see inside a token, which is what catches `lineStatus`
    // and equally what catches `disciPLINE` — the letters are there and the word is
    // not, exactly as in `polyline`. Twenty-one entries because the inventory is
    // asked in both directions and a shape cannot answer either; they replaced the
    // twenty-one that meant a `Lines` row, and NONE of those is left, which is this
    // file's proof that the sweep finished.
    DISCIPLINES: "the Disciplines table in TABLES",
    Discipline: "the `Discipline` link field on Purchase Requests",
    discipline: "a PR's own link array, from recordToPR",
    disciplines: "the rows getAllDisciplines returns",
    getAllDisciplines: "reads Disciplines rows",
    getDisciplineByRecordId: "reads one, by record id",
    recordToDiscipline: "the mapper both readers share",
    createDiscipline: "writes one",
    createDisciplineAction: "the Server Action that calls it",
    getPRsByDiscipline: "PRs under one Disciplines row",
    DisciplineForm: "the component that creates one",
    NewDisciplinePage: "the page that renders it",
    renderNewDisciplinePage: "its labeled inner render",
    disciplineId: "a Disciplines record id on the PR paths",
    disciplineIds: "those ids, from a Job's own link array",
    disciplineRecords: "the rows those ids resolve to",
    disciplineRecordId: "one such record id",
    disciplineLabel: "the Disciplines primary field",
    disciplineName: "the human-entered field",
    disciplineById: "rows keyed by record id",
    disciplinesForJob: "the rows of one Job",
    jobByDisciplineId: "Job record id per Disciplines row",
    setDisciplineId: "the form state setter for the picked row",
    line1: "the Addresses field `Line 1`",
    line2: "the Addresses field `Line 2`",
    polyline: "the SVG element",
    strokeLinecap: "the SVG attribute",
    strokeLinejoin: "the SVG attribute",
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

// #274 — the noun AND the verb now. Every inflection, because the noun went with
// #227 and the verb has two replacements (`invoiced` for the participle, `charges`
// for the transitive), so nothing is left for a screen to say.
const BILL_RE = /\bbill(?:s|ed|ing)?\b/i;

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
    const plantedBill = copyStrings('const X_COPY = { body: () => `this invoice bills more than it names` };');
    const plantedBilled = copyStrings('const X_COPY = { body: () => `40 EA billed, none delivered` };');
    assert(
        "assertion 1d fires on the verb in both inflections, and no other matcher does",
        plantedBill.some((c) => BILL_RE.test(c.text)) &&
            plantedBilled.some((c) => BILL_RE.test(c.text)) &&
            ![...plantedBill, ...plantedBilled].some(
                (c) => WORD_RE.test(c.text) || SHIPMENT_RE.test(c.text) || ARRIVAL_RE.test(c.text)
            )
    );
    // And it must NOT fire on the two verbs that replaced it, or the sweep would have
    // had nowhere to go and this matcher would bar its own remedy.
    assert(
        "  and not on `invoiced` or `charges`, which is where the word went",
        !BILL_RE.test("40 EA invoiced, none delivered") &&
            !BILL_RE.test("No invoice charges this order yet.")
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

    // ── 1d: and no *_COPY sentence says `bill` in any inflection (#274) ─────
    // THE WORD #227 LEFT STANDING, barred one issue later — and the thing that
    // changed is not the argument but the destination. `Invoices` gives no verb,
    // so `bill` was correct English with nothing competing for it; what #274
    // found is that the act already had a verb anyway, in every derivation built
    // on the table's name (`Invoiced Qty`, `uninvoicedQty`, #235's chip). The 23
    // strings went to `invoiced` where the word is a participle or a quantity and
    // to `charges` where it is transitive — `No invoice charges this order yet.`
    // was on a screen already. Copy only, and the three prose classes that keep
    // the word are in the header.
    log("");
    log("no *_COPY sentence says `bill`, `bills`, `billed` or `billing`:");
    const billOffenders = [];
    for (const [path, src] of sources) {
        for (const { copyName, text } of copyStrings(src)) {
            if (BILL_RE.test(text)) {
                billOffenders.push(`${path} ${copyName}: ${JSON.stringify(text)}`);
            }
        }
    }
    billOffenders.slice(0, 10).forEach((o) => log(`    ${o}`));
    check(
        `copy strings calling it anything but "invoiced" or "charges"${
            billOffenders.length ? ` (first: ${billOffenders[0]})` : ""
        }`,
        billOffenders.length,
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
    log("every barred word loses to something that still exists:");
    const tables = tableNamesFromSource();
    // ANTI-VACUITY, and it needs both halves: an empty parse and a clean base read
    // the same way, and a parse that returned every string literal in the file would
    // satisfy any lookup below.
    assert(`parsed ${tables.length} names out of TABLES without importing it`, tables.length >= 20);
    assert(
        "the parse resolves real names and not any string it passed",
        tables.includes("Deliveries") &&
            tables.includes("Disciplines") &&
            !tables.includes("Lines") &&
            !tables.includes("Shipments")
    );
    const orphaned = Object.entries(BEATEN_BY_TABLE)
        .filter(([, table]) => !tables.includes(table))
        .map(([word, table]) => `${word} → ${table}`);
    check(
        `no barred word whose winning table is gone${orphaned.length ? ` (${orphaned.join(", ")})` : ""}`,
        orphaned.length === 0 ? "none" : orphaned.join(", "),
        "none"
    );

    // #280 — THE SECOND PREMISE, READ OUT OF CLAUDE.md. `line` lost to `Lines` until
    // that table was renamed; what bars it now is #303's rule, which lives in the
    // file every session reads. Asking whether the sentence is still there is the
    // same question the table lookup above asks, one level up: a premise that can
    // lapse, checked rather than assumed.
    // Line endings normalized, the move `notes-index.mjs` and `screen-briefs.mjs`
    // both make on this file: a checkout can be CRLF and the sentence is matched
    // whole, so a wrap inside it would otherwise decide the answer.
    const claudeMd = readFileSync(repoPath("CLAUDE.md"), "utf8").replace(/\r\n/g, "\n");
    assert("CLAUDE.md was read", claudeMd.length > 10000);
    const ruleless = Object.entries(BEATEN_BY_RULE)
        .filter(([, sentence]) => !claudeMd.includes(sentence))
        .map(([word, sentence]) => `${word} → ${sentence}`);
    check(
        `no barred word whose rule is gone from CLAUDE.md${
            ruleless.length ? ` (${ruleless.join(", ")})` : ""
        }`,
        ruleless.length === 0 ? "none" : ruleless.join(", "),
        "none"
    );
    // ANTI-VACUITY for that lookup: it has to be seen to say no, or a typo'd
    // sentence would pass as "present" against a file this large.
    assert(
        "  and a rule CLAUDE.md does not state is reported",
        !claudeMd.includes("ROW TAKES WHATEVER NAME IS HANDY")
    );

    // And the two maps together have to cover what is actually barred, or a word
    // could be added to a matcher above and never acquire a premise at all.
    check(
        "every matcher's word carries a premise",
        [...Object.keys(BEATEN_BY_TABLE), ...Object.keys(BEATEN_BY_RULE)].sort().join(),
        "arrival,bill,line,shipment"
    );
    // Neither map may claim a word the other holds — one premise per word, or a
    // lapse on one side would be masked by the other.
    check(
        "no word carries two premises",
        Object.keys(BEATEN_BY_RULE).filter((w) => w in BEATEN_BY_TABLE).join(),
        ""
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
    assert("  including one the sweep left standing", found.has("termLine"));
    // #280 — BOTH DIRECTIONS OF ITS OWN SWEEP, named rather than left to the two
    // checks below: the table's new word is seen, and no identifier that meant a
    // `Lines` row survives. `getAllLines` stood here until then, which is what a
    // renamed anti-vacuity anchor looks like.
    assert("  and the table's new word", found.has("getAllDisciplines"));
    assert(
        "  and nothing still names a Lines row",
        !found.has("getAllLines") && !found.has("lineId") && !found.has("lineName")
    );
    assert("  and one #227 renamed is gone", !found.has("lineStatus") && !found.has("poLine"));
    assert("  and a name nobody ever wrote is absent", !found.has("shipmentStatus"));
    assert(
        "the stem matcher sees inside a token, which is what assertion 2 cannot",
        STEM_RE.test("orderedItemStatus") === false && STEM_RE.test("lineStatus")
    );
    // AND THE SHRINK #274 MADE IS A SWEEP RATHER THAN A BLIND SPOT. Ten entries left
    // this inventory in one commit, which is also what dropping `bill` out of
    // `STEM_RE` would look like from here: no unlisted names, no stale ones, a
    // shorter list. Two lines separate the two — the stem still MATCHES a token that
    // carries it, and no identifier under app/ + lib/ carries it any more.
    assert("  the stem matcher still sees the word #274 swept", STEM_RE.test("billedNotDelivered"));
    assert(
        "  and no identifier carries it, which is why it left the inventory",
        ![...found.keys()].some((n) => /bill/i.test(n))
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
