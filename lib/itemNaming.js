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
// A SECOND TABLE'S TYPED KEY USES IT NOW, AND THE NAME IS NARROWER THAN THE RULE
// (#338). `Tools."Tool Name"` is the same problem one axis over — a name a person
// types, no unique constraint behind it, and a second spelling splitting one
// tool's count in two — so `upsertTool` and `lib/toolRegistration.js` normalize
// through this function and compare case-insensitively at the lookup, exactly as
// `upsertMaterial` and `getMaterialByKey` do. A tool is not an item and this
// function's name says otherwise, which is narrow rather than wrong: the
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
// happens in an issue whose subject is already #18's call sites.
//
// SIZE GETS THE SAME TREATMENT, and for the same two reasons: Size is part of
// the natural key, so `1/2  in` and `1/2 in` would split one material in two;
// and Size is printed to the vendor as well (`2"`, `SCH 40`), so its case is
// equally not ours to rewrite. One function rather than two identical ones,
// since there is no difference in the rule.

/**
 * Trim and collapse internal whitespace, preserving case.
 * A nullish value normalizes to "" so callers can pass an optional field
 * straight through.
 */
export function normalizeItemText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}
