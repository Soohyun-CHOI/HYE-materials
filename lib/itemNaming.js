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
// getMaterialByKey compares LOWER(TRIM({Item Name})) against LOWER(TRIM(...)).
// Because this has already collapsed internal runs, that comparison is enough
// and no stored match-key field is needed — a second field would be one more
// thing that can fall out of step with the write path that fills it.
//
// It also does not unify abbreviations, word order, or plurals; see the offline
// check, which states those non-goals as cases rather than leaving them to be
// assumed.
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
