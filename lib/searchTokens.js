// How a typed query becomes match tokens, for every search box in the app (#325).
//
// THERE ARE TWO BOXES AND THERE WAS VERY NEARLY A SECOND RULE. `/materials` has
// tokenized a query since #19 — trim, collapse, fold case, split, drop duplicates —
// and #325 gives the four document lists a box of their own. Writing that second
// tokenizer beside the first is the duplication CLAUDE.md's own section forbids: two
// implementations of one judgment diverge, and catching the divergence then needs a
// third thing. So the judgment moved here and `buildSearchTokens` became a call.
//
// WHAT IS SHARED IS THE QUERY SIDE, AND THE MATCH SIDE IS NECESSARILY TWO. `/materials`
// asks Airtable, through `lib/airtableFormula.js:andSearchAll`, because it queries a
// table the screen does not otherwise fetch; the document lists ask JavaScript, because
// every row they could match is already in the browser (#324's arrangement). One
// semantic, two languages, and no way to make them one function — so this module is
// where the semantic is written down, and `matchesTokens` below is its JS half sitting
// next to the rule rather than spelled out at a call site.
//
// THE SEMANTIC, IN FULL:
//
//   FOLD BOTH SIDES. `lib/itemNaming.js:textMatchKey` is the fold — trim the ends,
//   collapse internal whitespace, lower-case — and it is the same one `upsertMaterial`
//   and `upsertTool` compare stored names under. The haystack is folded by its own
//   side: `andSearchAll` wraps the field in `LOWER()`, `matchesTokens` lower-cases
//   what it is handed.
//
//   EVERY TOKEN MUST APPEAR, ANYWHERE IN THE HAYSTACK. AND rather than OR, because
//   each extra word a reader types should NARROW — OR would make a longer query return
//   more, which is the opposite of what typing more means. Order does not matter as a
//   consequence, which is the point: `acme 2608` and `2608 acme` are one query.
//
//   EACH TOKEN IS A SUBSTRING. `pip` finds `Pipe` and `260803` finds
//   `HYE-INV-260803-02`, which a prefix rule would not — the fragment a person picks
//   out of a printed id is as often in the middle as at the front. #357 measured a
//   word-boundary rule against the catalog and rejected it on the asymmetry that
//   decides this whole family: a false match is narrowed by typing another word,
//   because every token narrows, and a missing match is recoverable by nothing.
//
//   AN EMPTY QUERY IS NO TOKENS, AND NO TOKENS IS NOT EVERYTHING. `andSearchAll` turns
//   an empty needle list into `FALSE()`; `matchesTokens` is asked only about a query
//   that produced tokens, because an unsearched box is the whole list rather than a
//   filter matching all of it. See `lib/listFilters.js:filtersActive`.
//
// PURE AND ALMOST DEPENDENCY-FREE, WITH THE EXTENSION SPELLED OUT. The offline tier
// runs under plain `node` with no module loader, which cannot resolve the
// extensionless intra-lib imports the rest of the app relies on Next to resolve — so
// an offline-pinned module either imports nothing or spells `.js`, and about twenty
// files under `lib/` do the second. Both of this module's importers are themselves
// offline-pinned, so this one has to as well.

import { textMatchKey } from "./itemNaming.js";

/**
 * A typed query as match tokens: folded, split, de-duplicated.
 *
 * `drop` is a list of whole tokens to discard, and `max` a ceiling on how many
 * survive. BOTH ARE `/materials`' AND NEITHER IS THIS RULE'S — they are the two steps
 * that made that box look like a different tokenizer, and passing them as arguments is
 * what turned it into the same one with a longer call. The document lists pass neither:
 * their haystack carries no separator a reader can type, and their query never reaches
 * Airtable, so the formula-length ceiling that `MAX_SEARCH_TOKENS` is derived from has
 * nothing to bound here.
 *
 * Duplicates go because AND-ing a token with itself narrows nothing, and the drop
 * happens BEFORE the de-duplication so a dropped token cannot occupy a slot under
 * `max`.
 */
export function searchTokens(query, { drop = [], max = null } = {}) {
    const cleaned = textMatchKey(query);
    if (!cleaned) return [];
    const dropped = new Set(drop);
    const words = cleaned.split(" ").filter((word) => word && !dropped.has(word));
    const unique = Array.from(new Set(words));
    return max === null ? unique : unique.slice(0, max);
}

/**
 * Whether one haystack carries every token — the JS half of the semantic above.
 *
 * THE HAYSTACK MAY BE SEVERAL VALUES JOINED, AND JOINING ON A SPACE IS SAFE. A token
 * never contains a space, because `searchTokens` split on one, so no token can straddle
 * the boundary between two joined values and match across it. That is what lets a
 * caller hand over a row's id, its second name, its vendor and its job as one string
 * without a separator nobody can type.
 *
 * NO TOKENS IS FALSE, NOT TRUE, which is `andSearchAll`'s `FALSE()` in JavaScript. A
 * caller who wants the unfiltered list must not ask this question at all.
 */
export function matchesTokens(haystack, tokens) {
    if (!tokens?.length) return false;
    const text = String(haystack ?? "").toLowerCase();
    return tokens.every((token) => text.includes(token));
}
