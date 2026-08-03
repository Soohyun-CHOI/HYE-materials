// The daily-sequence rule for a top-level ID (#164).
//
// #164 was one wrong field name inside one query: `generateNextInvoiceId` built
// `HYE-INV-{today}-{seq}` while counting `IS_SAME({Issue Date}, TODAY(), 'day')`,
// the VENDOR's date off their document — so the count was almost always 0 and
// every invoice entered on one day got `-01`. Nothing in the repo could see that,
// because the rule was four inline formulas inside a module the offline tier
// cannot import (lib/ids.js reaches lib/airtable/client.js, which throws at module
// load). The rule now lives in lib/idSequence.js, which imports nothing, and this
// is what pins it.
//
// Two parts, the arrangement formula-escaping.mjs uses:
//   1. BEHAVIOR of the pure rule — prefixes, the population membership test, the
//      max-not-count sequence, and the predicate prefixMatch builds.
//   2. SOURCE SHAPE of lib/ids.js — that no daily counter reads a date field any
//      more. Parsed, not text-matched.
//
// Part 2 is here rather than in guard-placement.mjs, which CLAUDE.md names as the
// home for source-shape checks, and the reason is scope: that file is about one
// KIND of claim (a guard runs before the side effect it protects, cleanup sits
// outside a rollback) and shares one helper table for it. This asserts something
// about one rule's implementation, and it belongs next to that rule's behavior so
// a reader sees both halves of what "the counter counts the ID prefix" means.
//
// WHAT A PASS DOES NOT PROVE. Part 2 is source shape, so it proves lib/ids.js does
// not NAME a date field in a formula — not that the query Airtable ran counted the
// right rows. Whether FIND(...) = 1 actually selects the day's siblings is
// Airtable's property, measured in scripts/tests/verify-invoice-ids-164.mjs, which
// also creates two invoices in one run and checks they get different numbers.

import { ID_KINDS, SEQ_PAD_LENGTH, dailyIdPrefix, dailyStamp, formatSequentialId, nextSequence } from "../../../lib/idSequence.js";
import { prefixMatch } from "../../../lib/airtableFormula.js";
import { isMain, standalone } from "./_harness.mjs";
import { parseFile, walk } from "./_ast.mjs";

export const title = "Daily ID sequence — the counted population is the ID prefix (#164)";

/**
 * A local noon date, built from components so the assertions hold in any
 * timezone. dailyStamp reads LOCAL getters (unchanged from the helpers it
 * replaced, because the Vercel process clock is UTC and production must not
 * move), so a `new Date("2026-08-03T...Z")` literal would drift west of GMT.
 */
const AUG_3 = new Date(2026, 7, 3, 12, 0, 0);
const JAN_9 = new Date(2026, 0, 9, 12, 0, 0);

/** Every date field that has ever been counted, plus the ones nearby. */
const DATE_FIELD_NAMES = [
    "Issue Date",
    "Created At",
    "Created Date",
    "Received Date",
    "Due Date",
    "Paid Date",
    "President Signed At",
    "Withdrawn At",
];

export function run({ check, log, assert }) {
    // --- Part 1: the rule itself ----------------------------------------
    log("the daily stamp (local getters, date passed in so this is pinnable):");
    check("2-digit year", dailyStamp(AUG_3, 2), "260803");
    check("4-digit year — PO only", dailyStamp(AUG_3, 4), "20260803");
    check("month and day are zero-padded", dailyStamp(JAN_9, 2), "260109");
    check("defaults to 2 digits", dailyStamp(AUG_3), "260803");

    log("");
    log("one prefix per family:");
    check("PR", dailyIdPrefix(ID_KINDS.PR, AUG_3), "HYE-PR-260803");
    check("PO keeps the 4-digit year", dailyIdPrefix(ID_KINDS.PO, AUG_3), "HYE-PO-20260803");
    check("Invoice", dailyIdPrefix(ID_KINDS.INVOICE, AUG_3), "HYE-INV-260803");
    check("Delivery", dailyIdPrefix(ID_KINDS.DELIVERY, AUG_3), "HYE-DL-260803");

    // The lengths the issue and CLAUDE.md both wrote down wrong. Recorded as
    // measurements rather than as a constant anything reads: `LEFT({Invoice ID},
    // 13)` matched 0 rows on the live base because the prefix is 14 characters,
    // and four families would need four such numbers. Nothing hard-codes a length
    // now, and these are here so the claim stays checkable.
    log("");
    log("prefix lengths — the reason no length is hard-coded anywhere:");
    check("Invoice prefix is 14 chars, not the 13 #164 was filed with", dailyIdPrefix(ID_KINDS.INVOICE, AUG_3).length, 14);
    check("PR is 13", dailyIdPrefix(ID_KINDS.PR, AUG_3).length, 13);
    check("PO is 15", dailyIdPrefix(ID_KINDS.PO, AUG_3).length, 15);
    check("Delivery is 13", dailyIdPrefix(ID_KINDS.DELIVERY, AUG_3).length, 13);

    log("");
    log("the ID field each family counts — never a date field:");
    check("PR", ID_KINDS.PR.idField, "PR ID");
    check("PO", ID_KINDS.PO.idField, "PO ID");
    check("Invoice", ID_KINDS.INVOICE.idField, "Invoice ID");
    check("Delivery", ID_KINDS.DELIVERY.idField, "Delivery ID");
    // The defect as a property rather than as four equalities: whatever a kind
    // names, it must not be one of the fields a date lives in.
    const kinds = Object.entries(ID_KINDS);
    assert(
        "no kind names a date field (the #164 defect, as a property)",
        kinds.every(([, kind]) => !DATE_FIELD_NAMES.includes(kind.idField))
    );
    assert("all four families are registered", kinds.length === 4);

    log("");
    log("assembling an ID:");
    check("padded to two digits", formatSequentialId("HYE-INV-260803", 2), "HYE-INV-260803-02");
    check("and the pad width is the shared constant", SEQ_PAD_LENGTH, 2);
    // Widening rather than wrapping or colliding. padStart does not truncate.
    check("past 99 the sequence widens, it does not wrap", formatSequentialId("HYE-INV-260803", 100), "HYE-INV-260803-100");

    log("");
    log("the sequence is MAX + 1, not count + 1:");
    check("an empty table starts at 1", nextSequence([], "HYE-INV-260803"), 1);
    check("nullish is an empty table", nextSequence(null, "HYE-INV-260803"), 1);
    check("no sibling starts at 1", nextSequence(["HYE-INV-260802-07"], "HYE-INV-260803"), 1);
    check(
        "consecutive siblings continue",
        nextSequence(["HYE-INV-260803-01", "HYE-INV-260803-02"], "HYE-INV-260803"),
        3
    );
    // The live gaps #164 measured: HYE-INV-260716 holds [02, 03] and
    // HYE-INV-260727 holds [03, 04], so count + 1 is a number that already exists
    // in both. This is the case that makes max load-bearing rather than tidy.
    check(
        "a gap from a deleted row is stepped over, not reused",
        nextSequence(["HYE-INV-260716-02", "HYE-INV-260716-03"], "HYE-INV-260716"),
        4
    );
    check(
        "the other measured gap",
        nextSequence(["HYE-INV-260727-03", "HYE-INV-260727-04"], "HYE-INV-260727"),
        5
    );
    check("order does not matter", nextSequence(["HYE-INV-260803-05", "HYE-INV-260803-01"], "HYE-INV-260803"), 6);
    check("a hand-typed 99 pushes the next one to 100", nextSequence(["HYE-PO-20260715-99"], "HYE-PO-20260715"), 100);

    log("");
    log("membership: the formula narrows, this function decides:");
    // A row the server-side FIND admits but that is not a sibling. Over-matching
    // must cost rows, never corrupt a number.
    check(
        "a longer date segment is not a sibling",
        nextSequence(["HYE-INV-260803X-09"], "HYE-INV-260803"),
        1
    );
    // A child ID is not a sibling: the parent alone decides the answer, and the
    // child adds nothing on top of it. (It would take a cross-table query to see
    // one here at all — this pins the rule, not a reachable case.)
    check(
        "a child ID under a sibling contributes nothing",
        nextSequence(["HYE-INV-260803-01", "HYE-INV-260803-01-001"], "HYE-INV-260803"),
        2
    );
    check(
        "and a child ID on its own is ignored entirely",
        nextSequence(["HYE-INV-260803-01-001"], "HYE-INV-260803"),
        1
    );
    check("a non-numeric tail is ignored", nextSequence(["HYE-INV-260803-QA"], "HYE-INV-260803"), 1);
    check("the bare prefix with no sequence is ignored", nextSequence(["HYE-INV-260803"], "HYE-INV-260803"), 1);
    check("a blank ID is ignored", nextSequence(["", null, undefined], "HYE-INV-260803"), 1);
    check("a non-string is ignored", nextSequence([42, {}], "HYE-INV-260803"), 1);
    // The hand-made fixtures on this base. `HYE-PR-TESTQA-99` is inert against
    // every generated prefix because a generated date segment is digits.
    check(
        "the TESTQA fixtures cannot be siblings of a generated prefix",
        nextSequence(["HYE-PR-TESTQA-01", "HYE-PR-TESTQA-99"], "HYE-PR-260803"),
        1
    );

    log("");
    log("the predicate (prefixMatch, in lib/airtableFormula.js):");
    check(
        "an anchored FIND, not a LEFT with a magic length",
        prefixMatch("Invoice ID", "HYE-INV-260803"),
        'FIND("HYE-INV-260803", {Invoice ID}) = 1'
    );
    check(
        "the prefix is escaped like any other interpolated value",
        prefixMatch("Invoice ID", 'HYE-INV-2608"03'),
        'FIND("HYE-INV-2608\\"03", {Invoice ID}) = 1'
    );
    const refuses = (fn) => {
        try {
            fn();
            return "accepted";
        } catch {
            return "refused";
        }
    };
    // FIND("", x) is 1 for every row, i.e. the whole table — the answer the OR
    // builders' FALSE() exists to avoid. Refuse rather than emit it.
    check("an empty prefix is refused, not matched against everything", refuses(() => prefixMatch("Invoice ID", "")), "refused");
    check("a nullish prefix is refused", refuses(() => prefixMatch("Invoice ID", null)), "refused");
    check("a braced field name is refused, as everywhere else", refuses(() => prefixMatch("F}{", "HYE")), "refused");

    // --- Part 2: lib/ids.js's shape --------------------------------------
    log("");
    log("lib/ids.js — no daily counter reads a date field (parsed, fail-closed):");

    const ids = parseFile("lib/ids.js");

    // Every filterByFormula in the file, and every string literal in it. A
    // reintroduced `IS_SAME({Issue Date}, TODAY(), 'day')` is caught by both.
    const formulas = [];
    const literals = [];
    walk(ids.ast, (node) => {
        if (node.type === "Property") {
            const name = node.key?.type === "Identifier" ? node.key.name : node.key?.value;
            if (name === "filterByFormula") formulas.push(ids.source.slice(node.value.start, node.value.end));
        }
        if (node.type === "Literal" && typeof node.value === "string") literals.push(node.value);
        if (node.type === "TemplateElement") literals.push(node.value.cooked ?? "");
    });

    assert("it still builds a filterByFormula at all (else this check is inert)", formulas.length > 0);
    check("exactly one, shared by all four families", formulas.length, 1);
    check("and it is a bare prefixMatch() call", formulas[0], "prefixMatch(kind.idField, prefix)");

    const named = DATE_FIELD_NAMES.filter((field) => literals.some((text) => text.includes(`{${field}}`)));
    assert(
        named.length === 0
            ? "no date field is referenced in any formula string"
            : `a date field is back in a formula: ${named.join(", ")}`,
        named.length === 0
    );
    assert(
        "TODAY() is gone — Airtable is no longer asked what day it is",
        !literals.some((text) => text.includes("TODAY()"))
    );
    assert("IS_SAME is gone with it", !literals.some((text) => text.includes("IS_SAME")));

    // The four generators must go through the shared helper, or "one rule" is a
    // comment rather than a fact. Each body is one return of mintDailyId(...).
    const GENERATORS = ["generateNextPRId", "generateNextPOId", "generateNextInvoiceId", "generateNextDeliveryId"];
    const delegating = [];
    walk(ids.ast, (node) => {
        if (node.type !== "FunctionDeclaration" || !GENERATORS.includes(node.id?.name)) return;
        const body = ids.source.slice(node.body.start, node.body.end);
        if (/\breturn mintDailyId\(/.test(body)) delegating.push(node.id.name);
    });
    check("all four generators delegate to the one helper", delegating.length, GENERATORS.length);
    for (const name of GENERATORS) {
        assert(`${name} delegates`, delegating.includes(name));
    }

    // The pure rule must not be re-implemented here — that is the duplication the
    // split exists to prevent, and it would be invisible to Part 1.
    let importsSequence = false;
    walk(ids.ast, (node) => {
        if (node.type === "ImportDeclaration" && /idSequence/.test(node.source.value)) importsSequence = true;
    });
    assert("and take the rule from lib/idSequence.js rather than restating it", importsSequence);
}

if (isMain(import.meta.url)) standalone(title, run);
