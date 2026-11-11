// Text a person typed (#184): what is kept of a name or a size, the key two strings are
// compared by, how the catalog spells a word it does not hold, and how a query becomes
// match tokens.
//
// TWO MODULES UNTIL #184, AND ONE RULE BETWEEN THEM. The first part below is #18's
// normalization (lib/typedText.js until then) and the second #325's tokenizer
// (lib/typedText.js), whose semantic was written as the first part's fold,
// `textMatchKey` — so a reader looking for how the app compares typed text had to know
// the second file stood on the first. Joined, the module imports nothing, which is what
// lets a `"use client"` file and the offline tier load it as they loaded either.

// Item text normalization (#18) — the one rule for how an item's Name and
// Size are stored, so the same material typed twice does not become two rows
// in the Materials identity table.
//
// Pure and dependency-free on purpose: scripts/tests/offline/item-naming.mjs
// pins it without credentials.
//
// WHAT IT DOES: trim the ends, collapse any run of internal whitespace to a
// single space. That is all.
//
// WHAT IT DELIBERATELY DOES NOT DO: change case. This exact string is printed
// on the PO PDF that goes to the vendor, where `SCH 40 PVC`, `304SS` and `NPT`
// are correct as written and a title-case or lower-case pass would mangle them
// irreversibly — the stored value is the only copy. Case-insensitivity belongs
// at the lookup instead, where it costs nothing and is reversible:
// getMaterialByKey compares LOWER(TRIM({Size})) against LOWER(TRIM(...)).
// Because this has already collapsed internal runs, that comparison is enough
// and no stored match-key field is needed — a second field would be one more
// thing that can fall out of step with the write path that fills it.
//
// THAT SENTENCE NAMED `{Item Name}` UNTIL #356 and the field it named is a
// LOOKUP now, of the category a requester picks, so there are no longer two
// spellings of a name to reconcile — `lib/materialIdentity.js` holds what
// replaced it. Size is the axis the rule still has work on, which is why the
// paragraph below, written about the name, is what survives.
//
// It also does not unify abbreviations, word order, or plurals; see the offline
// check, which states those non-goals as cases rather than leaving them to be
// assumed.
//
// A SECOND TABLE'S TYPED KEY USED IT FROM #338 TO #507, AND THE NAME IS NARROWER THAN
// THE RULE. `Tools."Tool Name"` was the same problem one axis over — a name a person
// typed, no unique constraint behind it, and a second spelling splitting one tool's
// count in two — so `upsertTool` and `lib/assetRegistration.js` normalized through
// this function and compared case-insensitively at the lookup, exactly as
// `upsertMaterial` and `getMaterialByKey` do. Since #507 the office types the asset
// catalog in Airtable and the app writes no category, so `lib/assetCategory.js` only
// compares the catalog's levels, under `textMatchKey` below. A category is not an item
// and this function's name says otherwise, which is narrow rather than wrong: the
// alternative was a second implementation of one rule, which is the duplication
// CLAUDE.md's own section forbids, and renaming it reaches every call site of
// #18. Recorded here and in docs/notes/naming.md rather than repaired.
//
// A THIRD CONSUMER ARRIVED IN #381 AND DOES NOT FIRE THE MOVE, which is worth
// saying because naming.md records a narrow name that a third caller DID end
// (`assignedJobsFor`, #362 → #363). `lib/userName.js` normalizes the two names a
// person types through this function, for the same reason `Size` uses it: a
// human typed it and trailing or doubled space is not part of the answer. But
// what holds this name in place was never the caller count — it is that renaming
// reaches every call site of #18 — so a third consumer strengthens the case and
// changes nothing. THE CONDITION, stated so it is a thing that can end: the move
// happens in an issue whose subject is already #18's call sites. #184 was not one,
// though it reached every one of them: it moved this rule into the module below with
// its import line and left every call where it stood, because that issue's subject is
// which file a rule is in, never what an export is called.
//
// SIZE GETS THE SAME TREATMENT, and for the same two reasons: Size is part of
// the natural key, so `1/2  in` and `1/2 in` would split one material in two;
// and Size is printed to the vendor as well (`2"`, `SCH 40`), so its case is
// equally not ours to rewrite. One function rather than two identical ones,
// since there is no difference in the rule.
//
// ONE PLACE DOES CHANGE CASE, AND IT IS A SEPARATE FUNCTION WITH ONE CALLER (#538).
// The asset catalog's page saves a category or a name the catalog does not hold
// yet with each word's first letter in capitals and the rest as typed —
// `capitalizeWords`. #538 asked it of those two alone: a size, a maker and a part
// number keep their case, as the material's Size above does. The rule lives here
// because this is where the app's rules for a typed name are; it reaches no call
// site of #18, and `normalizeItemText` still changes no case.

/**
 * Trim and collapse internal whitespace, preserving case.
 * A nullish value normalizes to "" so callers can pass an optional field
 * straight through.
 */
export function normalizeItemText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * The key two typed strings are the same under: normalized, then lower-cased.
 *
 * THE WHOLE RULE IN ONE PLACE, WHICH IT WAS NOT UNTIL #376. The rule is two
 * halves — whitespace fixed in the STORED value because a formula cannot collapse
 * an internal run, case folded only at the COMPARISON because the stored string is
 * the only copy of what somebody typed — and the composition of those halves is
 * what a caller actually needs. `lib/toolRegistration.js:toolNameKey` was that
 * composition written out, and #376's recipient names are a second consumer with a
 * different subject, so writing it again would be two copies of one judgment.
 *
 * NAMED FOR WHAT IT DOES RATHER THAN FOR EITHER SUBJECT, which is the fix this
 * module's own header asks for and could not have: `normalizeItemText` is narrow
 * because it is named after items and is used on tool names, and a second narrow
 * name beside it would repeat that. `toolNameKey` kept its own name and called
 * this, because a tool's name was what that identifier was about, until #507 took
 * the typed tool name away; the asset catalog calls this directly.
 *
 * ITS AIRTABLE COUNTERPART IS `LOWER(TRIM({Field}))`, which is the same fold one
 * layer down and cannot collapse an internal run — measured in #338. That is why
 * the normalization on the write side is load-bearing rather than tidy, and why
 * this function is safe to compare a stored value against.
 */
export function textMatchKey(value) {
    return normalizeItemText(value).toLowerCase();
}

/**
 * Typed text normalized, with each word's first letter in capitals and every other
 * letter as typed (#538): `pipe   cutter` is `Pipe Cutter`, `iPhone` is `IPhone`.
 *
 * A WORD IS WHAT SPACES PART, AND NOTHING ELSE STARTS ONE. So a hyphen's second half
 * keeps its case — `high-speed saw` is `High-speed Saw` — and so does a word opening on
 * something that is not a lower-case letter, `(blue)` and `2nd` among them. Only a
 * lower-case letter is raised; nothing is lowered, since the rest of a word is the typist's.
 * The asset catalog's page is the one caller, for a category or a name it does not hold yet;
 * one it holds keeps the spelling it has, which is the caller's to decide (`lib/assetCatalog.js`).
 */
export function capitalizeWords(value) {
    return normalizeItemText(value).replace(/(^|\s)(\p{Ll})/gu, (_, before, letter) => before + letter.toLocaleUpperCase("en-US"));
}

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
//   FOLD BOTH SIDES. `textMatchKey` above is the fold — trim the ends,
//   collapse internal whitespace, lower-case — and it is the same one `upsertMaterial`
//   compares stored names under, and the asset catalog its levels (#507; `upsertTool`
//   compared a tool's typed name under it until then). The haystack is folded by its
//   own side: `andSearchAll` wraps the field in `LOWER()`, `matchesTokens` lower-cases
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
