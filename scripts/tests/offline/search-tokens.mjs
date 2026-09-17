// How a typed query becomes match tokens, for both of the app's search boxes (#325).
//
// WHAT THIS FILE EXISTS FOR. `/materials` has tokenized a query since #19 and the four
// document lists got a box of their own in #325, and the second one was very nearly a
// second tokenizer — the duplication CLAUDE.md's own "one rule, one implementation"
// section forbids, and the kind that diverges quietly because both halves keep working.
// So the rule moved to `lib/searchTokens.js` and what is pinned here is that it is ONE
// rule with two arguments rather than two rules that currently agree.
//
// THE MATCH SIDE IS NECESSARILY TWO AND THAT IS NOT A DEFECT. `/materials` asks
// Airtable through `andSearchAll`, because it queries a table its screen does not
// otherwise fetch; the lists ask JavaScript, because every row they could match is
// already in the browser. One semantic, two languages. The JS half is `matchesTokens`
// and is pinned below; the Airtable half is `offline/formula-escaping.mjs`'s, and the
// last section here holds the two to the same answers so a divergence between them
// fails somewhere rather than nowhere.
//
// WHAT A PASS DOES NOT PROVE. That either box RENDERS, or that Airtable's `SEARCH()`
// really behaves as the JS mirror below assumes — that was measured against the live
// parser in #159 and #164 and is not re-measured here.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { isMain, standalone } from "./_harness.mjs";
import { matchesTokens, searchTokens } from "../../../lib/searchTokens.js";
import { buildSearchTokens, MAX_SEARCH_TOKENS } from "../../../lib/materialPriceView.js";
import { andSearchAll } from "../../../lib/airtableFormula.js";
import { axesFor } from "../../../lib/listFilters.js";

export const title = "How a typed query becomes match tokens (#325)";

export function run({ check, assert, log }) {
    // ── 1: the fold ─────────────────────────────────────────────────────────
    log("a query is folded the way two typed strings are compared (#18's textMatchKey):");
    check("the ends are trimmed", searchTokens("  acme  ").join(","), "acme");
    check("an internal run collapses", searchTokens("acme   supply").join(","), "acme,supply");
    check("tabs and newlines are whitespace too", searchTokens("acme\t\nsupply").join(","), "acme,supply");
    check("case is folded, because an id is printed upper and typed lower", searchTokens("HYE-INV").join(","), "hye-inv");
    check("duplicates go, since AND-ing a token with itself narrows nothing", searchTokens("acme acme").join(","), "acme");
    check("order is preserved among what survives", searchTokens("b a b").join(","), "b,a");

    log("");
    log("and an empty query is no tokens, which is not the same as everything:");
    check("an empty string", searchTokens("").length, 0);
    check("whitespace only", searchTokens("   ").length, 0);
    check("undefined", searchTokens(undefined).length, 0);
    check("null becomes nothing, never the word", searchTokens(null).join(","), "");

    // ── 2: the two arguments, which are `/materials`' and not the rule's ─────
    log("");
    log("the two steps that belong to one screen are arguments, not the rule:");
    check("nothing is dropped by default", searchTokens("a > b").join(","), "a,>,b");
    check("  `drop` removes a whole token and only a whole one", searchTokens("a > b", { drop: [">"] }).join(","), "a,b");
    check(
        "  a token merely CONTAINING the dropped text survives",
        searchTokens("a >b c", { drop: [">"] }).join(","),
        "a,>b,c"
    );
    check("nothing is capped by default", searchTokens("a b c d e").length, 5);
    check("  `max` caps what survives", searchTokens("a b c d e", { max: 3 }).join(","), "a,b,c");
    // THE ORDER OF THE TWO MATTERS. Dropping after the cap would let a separator occupy
    // a slot and push a real word out — which is the failure #357 measured when the cap
    // was 6 and a pasted category path did not narrow at all.
    check(
        "the drop happens before the cap, so a separator never costs a slot",
        searchTokens("a > b", { drop: [">"], max: 2 }).join(","),
        "a,b"
    );

    // ── 3: the JS match half ────────────────────────────────────────────────
    log("");
    log("every token must appear somewhere in the haystack, as a substring:");
    check("one token present", matchesTokens("Acme Supply", ["acme"]), true);
    check("one token absent", matchesTokens("Acme Supply", ["beta"]), false);
    check("both present", matchesTokens("HYE-INV-260803-02 Acme", ["acme", "2608"]), true);
    check("one of two absent narrows it away", matchesTokens("HYE-INV-260803-02 Acme", ["acme", "zzz"]), false);
    check("the haystack is folded, the tokens arrive folded", matchesTokens("ACME", ["acme"]), true);
    check("a substring, not a prefix — the useful fragment is often mid-string", matchesTokens("HYE-INV-260803-02", ["260803"]), true);
    check("  and not a word boundary either", matchesTokens("Pipe", ["pip"]), true);
    // NO TOKENS IS FALSE, which is `andSearchAll`'s FALSE() in JavaScript. A caller who
    // wants the unfiltered list must not ask at all — `matchesFilters` returns early.
    check("no tokens matches nothing, not everything", matchesTokens("anything", []), false);
    check("  and neither does a nullish token list", matchesTokens("anything", undefined), false);
    check("a nullish haystack matches no token", matchesTokens(null, ["a"]), false);

    // ── 4: one rule, two callers ────────────────────────────────────────────
    log("");
    log("both boxes call it, and `/materials`' two steps are the only difference:");
    for (const query of ["ball valve 2\"", "Stainless Steel (SUS) > Tee", "  PIPE  ", ""]) {
        check(
            `\`${query}\` tokenizes the same for /materials as the arguments say`,
            buildSearchTokens(query).join("|"),
            searchTokens(query, { drop: [">"], max: MAX_SEARCH_TOKENS }).join("|")
        );
    }
    // THE LISTS PASS NEITHER ARGUMENT, and both absences are decisions. Their haystack
    // carries no separator a reader can type, and their query never reaches Airtable, so
    // the formula-length ceiling MAX_SEARCH_TOKENS is derived from bounds nothing here.
    const long = Array.from({ length: MAX_SEARCH_TOKENS + 5 }, (_, i) => `t${i}`).join(" ");
    assert(
        "a list query is not capped at the materials ceiling",
        searchTokens(long).length === MAX_SEARCH_TOKENS + 5
    );
    assert(
        "  while the materials query still is",
        buildSearchTokens(long).length === MAX_SEARCH_TOKENS
    );

    // ── 5: the two match halves answer alike ────────────────────────────────
    log("");
    log("the Airtable half and the JS half are one semantic in two languages:");
    // The formula is not executed here — that was measured against the live parser in
    // #159 and #164. What is asserted is the SHAPE it commits to: one clause per token,
    // AND-ed, each a SEARCH() of the needle in a LOWER()ed field, and FALSE() for none.
    const formula = andSearchAll("Material Label", searchTokens("acme 2608"));
    assert("one SEARCH clause per token", (formula.match(/SEARCH\(/g) || []).length === 2);
    assert("  AND-ed, so each extra word narrows", formula.startsWith("AND("));
    assert("  and the field is folded on that side too", formula.includes("LOWER({Material Label})"));
    check("  an empty needle list is FALSE(), matching nothing", andSearchAll("F", searchTokens("")), "FALSE()");
    // AND THE JS HALF AGREES ROW FOR ROW on the property that matters: AND over tokens.
    // A haystack carrying one of two tokens is admitted by neither.
    assert(
        "both halves narrow on the second token rather than widening",
        matchesTokens("acme", ["acme"]) === true && matchesTokens("acme", ["acme", "2608"]) === false
    );

    // ── 6: anti-vacuity ─────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the alternatives are built and seen to answer differently:");
    // OR over tokens, which is what a longer query returning MORE looks like. Written
    // out because "we chose AND" is not a check.
    const orTokens = (haystack, tokens) =>
        tokens.some((t) => String(haystack).toLowerCase().includes(t));
    assert(
        "an OR over tokens admits a row the shipped rule refuses",
        orTokens("Acme Supply", ["acme", "2608"]) === true &&
            matchesTokens("Acme Supply", ["acme", "2608"]) === false
    );
    // Prefix matching, which is `lib/airtableFormula.js:prefixMatch`'s rule and is what
    // this box would have used had "people type from the front" been read as "only the
    // front". It loses the fragment a person actually picks out of a printed id.
    const prefixOnly = (haystack, tokens) =>
        tokens.every((t) => String(haystack).toLowerCase().startsWith(t));
    assert(
        "a prefix rule loses a mid-string fragment the shipped rule finds",
        prefixOnly("HYE-INV-260803-02", ["260803"]) === false &&
            matchesTokens("HYE-INV-260803-02", ["260803"]) === true
    );
    // A case-sensitive rule, which is what `prefixMatch` measured itself to be (#164) and
    // is the other half of why it could not serve this box.
    const caseSensitive = (haystack, tokens) => tokens.every((t) => String(haystack).includes(t));
    assert(
        "a case-sensitive rule loses a lower-cased id",
        caseSensitive("HYE-INV-260803-02", ["hye-inv"]) === false &&
            matchesTokens("HYE-INV-260803-02", ["hye-inv"]) === true
    );

    // AND THE LISTS REALLY DO CALL THIS. A rule with one caller is a rule the second box
    // could quietly stop using — `offline/list-filters.mjs` pins what each list searches,
    // and this is the seam between the two files.
    const searchAxes = ["/prs", "/pos", "/deliveries", "/invoices"].map((route) =>
        axesFor(route).find((a) => a.control === "search")
    );
    assert("all four document lists declare a search axis", searchAxes.every(Boolean));
    assert(
        "  and each names at least its own id and the two subjects",
        searchAxes.every((axis) => axis.keys.length >= 4)
    );
}

if (isMain(import.meta.url)) standalone(title, run);
