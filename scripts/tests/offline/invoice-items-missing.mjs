// An invoice with no item rows says one thing in two places (#330).
//
// WHAT THIS FILE IS FOR. `createInvoiceAction` has refused a submission carrying
// no rows since #15, and nothing else in the app held the fact — so a hand edit
// in Airtable left an invoice rendering seven column heads over an empty body
// with the totals footer under it, which reads as an invoice charging for
// nothing. #330 gives the record's own state a sentence and a refusal, and they
// are ONE sentence because they are one fact.
//
// THE MUTANT THIS EXISTS FOR IS THE MERGE, NOT THE SPLIT. The two write paths
// both refuse "an invoice with no items", and the obvious tidy-up is to give
// them one string — which would be one word for two facts: `createInvoiceAction`
// refuses a SUBMISSION, on a form that can add a row and whose
// `Add at least one item.` is an instruction a reader can follow;
// `updateInvoiceAction` refuses a RECORD, on a screen where adding is out of
// scope (#117). So this file asserts the pairing in both directions — the update
// action and the detail screen say the same string, the create action does not
// say it, and the module's name points at the FACT rather than at the shared
// rule so the name itself does not invite the merge.
//
// WHAT A PASS DOES NOT PROVE. That anything renders: this tier reads source and
// judges pure functions and never opens a page, so whether the table is really
// gone in that state, and whether the sentence reaches a browser, are measured in
// `scripts/tests/verify-invoice-items-330.mjs` against the live app.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { isMain, standalone } from "./_harness.mjs";
import { parseFile, repoPath, walk } from "./_ast.mjs";
import { ITEMS_MISSING_COPY, invoiceItemsMissing } from "../../../lib/invoiceItemsMissing.js";

export const title = "An invoice with no items says one thing in two places (#330)";

const SCREEN = "app/invoices/[invoiceId]/page.js";
const UPDATE_ACTION = "app/invoices/[invoiceId]/actions.js";
const CREATE_ACTION = "app/invoices/new/actions.js";
const OWNER = "lib/invoiceItemsMissing.js";

/** Every string literal and JSX text node in a file. */
function allText(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
        if (n.type === "JSXText") out.push(n.value);
    });
    return out;
}

export function run({ check, assert, log }) {
    // ── 1: the fact ─────────────────────────────────────────────────────────
    log("the predicate reads the reverse-link array and nothing else:");
    check("an invoice with no items", invoiceItemsMissing({ invoiceItems: [] }), true);
    check("  and one with a row", invoiceItemsMissing({ invoiceItems: ["recA"] }), false);
    check("  and one with three", invoiceItemsMissing({ invoiceItems: ["a", "b", "c"] }), false);
    // THE MAPPER'S `|| []` MEANS THE KEY IS ALWAYS THERE, but a caller holding a
    // record from somewhere else must not get a crash instead of an answer, and an
    // absent key is the same claim as an empty one.
    check("a record with no key at all", invoiceItemsMissing({}), true);
    check("  and no record at all", invoiceItemsMissing(undefined), true);
    check("  and null", invoiceItemsMissing(null), true);
    // ANTI-VACUITY: the predicate has to be seen saying both things, which the four
    // above do — and it must not be reading something other than the array.
    assert(
        "it answers off `invoiceItems` and not off some other key",
        invoiceItemsMissing({ invoiceItems: [], items: ["x"], invoiceItemIds: ["y"] }) === true
    );

    // ── 2: one sentence, and what it may not say ────────────────────────────
    log("");
    log("the sentence is one sentence, with one noun and no waiting word:");
    const sentence = ITEMS_MISSING_COPY.absent;
    check("the copy has exactly one member", Object.keys(ITEMS_MISSING_COPY).join(","), "absent");
    assert("it names its noun", /\bitems\b/.test(sentence));
    // ONE NOUN FOR ONE THING. `rows` and `lines` are the two the drafting reached
    // for; `Invoice Items` is the table, so its row is an invoice item (#303), and
    // `line` names no row of any table since #280.
    for (const barred of ["rows", "row", "lines", "line", "charges"]) {
        assert(`  and does not also call them \`${barred}\``, !new RegExp(`\\b${barred}\\b`, "i").test(sentence));
    }
    // NO `yet`. `lib/listFilters.js` bars it from an empty state it is false of, and
    // this is the sharpest case: nothing is coming, because the app cannot add to
    // this invoice and did not make it.
    assert("  and promises nothing is coming", !/\byet\b/i.test(sentence));
    assert("  it is sentences, not a fragment", /^[A-Z].*\.$/.test(sentence.trim()));
    // SHORT, BECAUSE THE NEIGHBORS ARE. `No delivery has been matched to this
    // invoice yet.` is 48 characters, two sections down the same page. A ceiling
    // rather than a length, so a rewording has room without having room to become a
    // paragraph.
    assert(`  and is under 100 characters (${sentence.length})`, sentence.length < 100);

    // ── 3: the pairing, in both directions ──────────────────────────────────
    log("");
    log("the record's two surfaces say it, and the submission's refusal does not:");
    for (const rel of [SCREEN, UPDATE_ACTION]) {
        const src = readFileSync(repoPath(rel), "utf8");
        assert(`${rel} takes the sentence from ${OWNER}`, src.includes("ITEMS_MISSING_COPY"));
        assert(`  and the predicate with it`, src.includes("invoiceItemsMissing"));
        // THE LITERAL MUST NOT BE WRITTEN OUT BESIDE THE IMPORT, which is the shape
        // that lets one of the two drift while both still "share" the constant.
        const written = allText(parseFile(rel).ast).filter((t) => t.includes(sentence));
        check(`  and writes it nowhere itself`, written.length, 0);
    }
    // THE CREATE PATH KEEPS ITS OWN WORD AND MUST NOT BE FOLDED IN. Its refusal is
    // about the submission and is an instruction its form can carry out.
    const createSrc = readFileSync(repoPath(CREATE_ACTION), "utf8");
    assert("the create action does not say the record's sentence", !createSrc.includes(sentence));
    assert("  and does not import this module", !createSrc.includes("invoiceItemsMissing"));
    assert("  and still refuses a submission with no rows", /items\.length === 0/.test(createSrc));
    assert(
        "  in its own words, which name an act its form offers",
        allText(parseFile(CREATE_ACTION).ast).includes("Add at least one item.")
    );

    // ── 4: nobody else says it ──────────────────────────────────────────────
    log("");
    log("and no third place writes the sentence:");
    const strays = [];
    for (const rel of [SCREEN, UPDATE_ACTION, CREATE_ACTION]) {
        for (const t of allText(parseFile(rel).ast)) {
            if (t.includes("This invoice has no")) strays.push(`${rel}: ${JSON.stringify(t)}`);
        }
    }
    check(
        `no file writes a no-items sentence of its own${strays.length ? ` (${strays.join("; ")})` : ""}`,
        strays.length,
        0
    );
    // ANTI-VACUITY for the scan: it has to be seen finding a sentence that IS there.
    assert(
        "the text walk reads this screen's strings at all",
        allText(parseFile(SCREEN).ast).some((t) => t.includes("Recorded by:"))
    );
}

if (isMain(import.meta.url)) standalone(title, run);
