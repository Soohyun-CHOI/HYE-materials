// One sentence, one kind of item row (#303).
//
// Four tables hold item rows — `PR Items`, `PO Items`, `Invoice Items`,
// `Delivery Items` — and a bare `item` names a row on all four. A row takes its own
// table's name in the singular, a string with only one kind in it may drop the
// modifier, and A SENTENCE NAMING TWO CARRIES BOTH. That last clause is what this
// file holds, because it is the one a sweep can undo by accident: dropping a
// modifier reads as tightening the copy and leaves a sentence where one word stands
// for two tables. `Every item needs an ordered item from its PO.` shipped that way
// and was read that way for four issues.
//
// THE ASSERTION IS MIXING, NOT CORRECTNESS, and the difference is the whole reason
// this file is short. What it checks is that no ONE SENTENCE contains both a
// modified item noun and a bare one. That is a question about the string in front of
// it. What it cannot ask is which TABLE a bare `item` points at — the one field of
// four that `docs/briefs/strings/README.md` measured as computable by no script —
// so a sentence with no modified noun in it passes whatever it means. `lib/overage.js`
// said `this item` for an ordered item in two banners while a third in the same
// constant said `this ordered item`; #303 fixed all three by hand and this file would
// not have found the two.
//
// THREE FORMS WERE TRIED AND THIS IS THE ONE THAT IS TRUE. Flagging a bare `item`
// beside an order word gave three true positives against five false ones on the
// current corpus, and silencing five would need the list of names the whole
// `screen-strings.mjs` exercise exists against. Reading a builder's parameter to see
// whether it is an ordered item is dataflow on an untyped `f`. Mixing is neither: it
// is a property of one sentence, with no exemptions at all.
//
// AND IT ONLY BECAME BUILDABLE BECAUSE THE COPY MOVED FIRST. The invoice form said
// `Every item on this purchase order is already on another charge of this invoice.`
// Modifying both nouns in place gives `… on another invoice item of this invoice`,
// which is worse English, and leaning on the possessive gives `… on another item of
// this invoice`, which reads correctly to a person and is invisible to any matcher —
// so the rule would have had to accept a possessive as a modifier, i.e. stop being
// mechanical. #303 restructured instead: `This invoice already charges every ordered
// item on this purchase order. Pick a different purchase order for this item, or
// remove it.` Each sentence names one kind, the copy is shorter, and the wording the
// check wants is the wording a person wants. Where that restructuring is impossible
// the modifier is explicit — `Every invoice item needs an ordered item from its PO.`
// states a relation between two rows and cannot be split — and that passes too.
//
// SCOPE IS EVERY SCREEN'S STRINGS, via `scripts/screen-strings.mjs` rather than a
// second collector. That file is behind a main guard for this. What it cannot see is
// `docs/briefs/strings/unfindable.md`'s seven shapes; #303 read those by hand and
// found `DELETE_COPY` and `PAIRING_COPY` already conformant, which is recorded there
// rather than here.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { listRoutes, stringsForRoute } from "../../screen-strings.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One sentence, one kind of item row (#303)";

/**
 * The modified forms, one per table that holds item rows.
 *
 * `ordered item` is `PO Items` and is not that table's name spelled out, which is
 * `naming.md`'s one recorded divergence of this kind: no table owns `ordered` or
 * `item`, so the screens chose a phrase. The other three are their tables'.
 */
const MODIFIED = /\b(ordered|invoice|delivery|PR|purchase request) items?\b/i;

/** A bare one: `item`/`items` with none of the modifiers above in front of it. */
const BARE = /(^|[^-\w])(?<!\b(?:ordered|invoice|delivery|PR|purchase request) )items?\b/i;

/**
 * Sentence boundaries, and they have to be crude enough to be predictable.
 *
 * Split after `.`, `!` or `?` followed by whitespace. `Loading PO items...` keeps
 * its ellipsis because nothing follows it; a decimal never has a space after the
 * point; and no screen string in this app carries `e.g.` or `Inc.` mid-sentence —
 * asserted below rather than assumed, since the day one does this splitter gets it
 * wrong in the safe direction (two half-sentences, each with fewer nouns in it).
 */
function sentences(text) {
    return String(text)
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Does one sentence name a modified item row and a bare one at the same time? */
export function mixesModifiedAndBare(sentence) {
    return MODIFIED.test(sentence) && BARE.test(sentence);
}

/**
 * Every screen string, with a wrapped concatenation put back together first.
 *
 * The extractor reports one entry per string literal or template chunk, so
 * `"… ordered " + (n === 1 ? "item" : "items") + " it was recorded against"` arrives
 * as three and a modified phrase can straddle two of them. TWO CONDITIONS REJOIN
 * THEM and both are needed: the earlier chunk does not end in sentence punctuation,
 * and the two sit within two lines of each other. A concatenation is written on
 * consecutive lines, so that is the shape being modelled — and two properly
 * punctuated neighbours can never merge, which is what keeps this from inventing a
 * sentence out of two unrelated strings.
 *
 * WHERE IT STILL FAILS IT FAILS SAFE. A chunk boundary the conditions do not rejoin
 * leaves `ordered ` in one piece and `item` in the other, and the second has no
 * modified noun beside it, so the pair passes. That is a false negative — this file
 * seeing less than it could — rather than a sentence flagged for a defect it does not
 * have.
 */
function sentencesPerScreen() {
    const out = [];
    for (const route of listRoutes()) {
        const { strings } = stringsForRoute(route);
        const byFile = new Map();
        for (const s of strings) {
            if (s.cls !== "read") continue;
            if (!byFile.has(s.file)) byFile.set(s.file, []);
            byFile.get(s.file).push(s);
        }
        for (const [file, list] of byFile) {
            const runs = [];
            for (const s of list) {
                const previous = runs[runs.length - 1];
                const continues =
                    previous &&
                    !/[.!?]["')\]]?$/.test(previous.text.trim()) &&
                    Math.abs(s.line - previous.line) <= 2;
                if (continues) {
                    previous.text += s.text;
                    previous.line = s.line;
                } else {
                    runs.push({ text: s.text, line: s.line });
                }
            }
            for (const run of runs) {
                for (const sentence of sentences(run.text)) out.push({ route, file, sentence });
            }
        }
    }
    return out;
}

/**
 * Every string #303 reworded, with the screen it has to still be on.
 *
 * WHY IT IS HERE AND NOT IN `offline/screen-briefs.mjs`. That file's `PINNED` list
 * requires a sentence to be in a loadable copy constant AND quoted in a brief, which
 * is the right pair for a tier-1 word and cannot reach three of these: the refusal
 * and both halves of the amber note are written straight into an action and into JSX,
 * where no constant holds them. `_shared.md` says a tier-3 word is protected against
 * DELETION and not against REWORDING — this closes that for the strings this issue
 * touched, because the extractor already produces them per screen and asking whether
 * one is still there is one line.
 *
 * THE TWO OVERAGE SENTENCES ARE TIER 1 AND STILL BELONG HERE, for the other half of
 * the same gap: `OVERAGE_COPY` holds them, but no brief quotes either verbatim —
 * `deliveries-deliveryId.md` paraphrases one — so `PINNED` would fail on the brief
 * side rather than hold the wording. One mechanism for the whole change set is worth
 * more than two thirds of it under two.
 */
const REWORDED = [
    ["/invoices/new", "Every invoice item needs an ordered item from its PO."],
    ["/invoices/new", "This invoice already charges every ordered item on this purchase order."],
    ["/invoices/new", "Pick a different purchase order for this item, or remove it."],
    ["/invoices/new", "Pick this item's PO first"],
    ["/invoices/new", "Every item's quantity has to be a whole number."],
    ["/invoices/[invoiceId]", "⚠ An item on this invoice differs from what its order agreed"],
    ["/prs", "No single invoice charges as much of this ordered item as was delivered beyond the"],
    ["/prs", "More than one invoice could supply the quotation and they charge this ordered item at"],
    ["/prs", "least this much of the ordered item at the same price"],
    ["/materials/[materialId]", "No purchase orders recorded for this material yet."],
];

export function run({ check, assert, log }) {
    const all = sentencesPerScreen();

    // ── the wording, per screen ─────────────────────────────────────────────
    log("every string #303 reworded is still the string its screen renders:");
    const byRoute = new Map();
    for (const [route] of REWORDED) {
        if (!byRoute.has(route)) {
            byRoute.set(route, stringsForRoute(route).strings.map((s) => s.text).join("  "));
        }
    }
    const missing = REWORDED.filter(([route, text]) => !byRoute.get(route).includes(text));
    for (const [route, text] of missing) log(`  ${route}  ${JSON.stringify(text)}`);
    check("reworded strings no longer on their screen", missing.length, 0);
    // ANTI-VACUITY: the haystacks have to be real, or every `includes` is vacuously
    // true against an empty string and this section passes on a broken extractor.
    assert("each screen yielded strings to search", [...byRoute.values()].every((h) => h.length > 200));
    assert(
        "  and the search is seen to say no",
        !byRoute.get("/invoices/new").includes("Every charge's quantity has to be a whole number.")
    );

    log("");

    // ANTI-VACUITY FIRST, because "no sentence mixes" and "no sentence was read" are
    // the same result. Three things have to be seen to work: the collection, the
    // splitter, and both matchers.
    log("the collection and the matchers can see what they are looking for:");
    assert("sentences were collected from every screen", all.length > 400);
    assert(
        "  including the refusal that states the rule's own case",
        all.some((s) => /Every invoice item needs an ordered item from its PO\./.test(s.sentence))
    );
    assert(
        "  and the restructured pair, as two sentences rather than one",
        all.some((s) => /^This invoice already charges every ordered item/.test(s.sentence)) &&
            all.some((s) => /^Pick a different purchase order for this item/.test(s.sentence))
    );
    check("the splitter splits", sentences("One item. Two ordered items.").length, 2);
    check("  and leaves an ellipsis alone", sentences("Loading PO items...").length, 1);
    assert("the modified matcher matches", MODIFIED.test("an ordered item"));
    assert("  all four forms", ["ordered", "invoice", "delivery", "PR"].every((m) => MODIFIED.test(`one ${m} item`)));
    assert("the bare matcher matches", BARE.test("Add at least one item."));
    assert("  and does not match a modified one", !BARE.test("an ordered item"));
    assert("  even mid-sentence", !BARE.test("needs an ordered item from its PO"));
    // The planted violation. This is the sentence the app shipped, and the matcher
    // has to be seen failing it or the pass below means nothing.
    assert(
        "  the pair together flag the sentence #303 removed",
        mixesModifiedAndBare("Every item needs an ordered item from its PO.")
    );
    assert(
        "  and pass the one that replaced it",
        !mixesModifiedAndBare("Every invoice item needs an ordered item from its PO.")
    );
    // And the splitter's own premise: no screen string carries a mid-sentence
    // abbreviation, which is what would make the split land in the wrong place.
    const abbreviated = all.filter((s) => /\b(e\.g|i\.e|Inc|Ltd|No|vs|etc)\.\s/.test(s.sentence));
    check(
        `screen sentences with a mid-sentence abbreviation${
            abbreviated.length ? ` (${abbreviated[0].file})` : ""
        }`,
        abbreviated.length,
        0
    );

    // ── the rule ────────────────────────────────────────────────────────────
    log("");
    log("no sentence names a modified item row and a bare one at once:");
    const mixed = all.filter((s) => mixesModifiedAndBare(s.sentence));
    for (const m of mixed) log(`  ${m.route}  ${m.file}  ${JSON.stringify(m.sentence)}`);
    check("sentences mixing the two", mixed.length, 0);
}

if (isMain(import.meta.url)) standalone(title, run);
