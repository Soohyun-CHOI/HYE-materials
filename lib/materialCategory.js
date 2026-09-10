/**
 * The composed label a `Material Categories` row carries (#354): the four
 * levels, the two words that drop out, the separator, the rule that joins them,
 * and the Airtable formula text that computes it on the base.
 *
 * WHAT THIS MODULE DOES NOT DO IS WRITE A LABEL. `Material Categories."Category
 * Label"` is a formula, so the base computes every one of them and nothing here
 * — and nothing in `scripts/import/` — ever puts that string into a record. A
 * path added by hand in Airtable therefore gets a correct label for free, which
 * is the whole reason the label is a formula rather than a column somebody
 * fills in.
 *
 * SO WHY IS THE RULE HERE AS WELL. `filterByFormula` cannot call JavaScript and
 * a formula field cannot call this function, so the duplication is STRUCTURAL
 * rather than provisional — there is no measurable condition whose lifting would
 * merge the two, which is the test CLAUDE.md's "One rule, one implementation"
 * section sets. #244 is the worked precedent one axis over (`PO Items."Has
 * Uninvoiced Qty"` against `lib/poItemQty.js:hasUninvoicedQty`), and its answer
 * is the one taken here: nothing re-derives the rule, and a credentialed check
 * compares the live values against this implementation on every run
 * (`scripts/tests/verify-material-categories-354.mjs`). What that check buys is
 * precisely that the values were produced by the OTHER implementation.
 *
 * AND THE FORMULA IS GENERATED FROM THE SAME CONSTANTS, NOT TYPED BESIDE THEM.
 * `CATEGORY_LABEL_FORMULA` is built below from `CATEGORY_LEVELS`,
 * `CATEGORY_LABEL_SKIPPED` and `CATEGORY_LABEL_SEPARATOR`, so a change to any of
 * the three moves both halves in one edit and the offline check compares the two
 * for agreement rather than for equality of two hand-written texts. The string
 * is 1,100-odd characters and is not meant to be read in the Airtable UI: the
 * import script PATCHes it onto the field, and this file is where it is edited.
 *
 * NOTHING HERE TRIMS, AND THAT IS DELIBERATE. An Airtable formula comparing two
 * text fields does not trim either, so trimming on this side would make the two
 * implementations disagree on a value with a stray space — the one class of
 * disagreement the check above exists to catch. The invariant lives on the DATA
 * instead: `scripts/tests/offline/material-categories.mjs` asserts the committed
 * CSV carries no leading, trailing or doubled whitespace in any of its 3,108
 * name cells, and the import script refuses a row that does.
 *
 * Offline-safe: imports nothing, reaches nothing under `lib/airtable/`.
 */

/**
 * The four levels of HQ's tree, outermost first, as the pair of column names
 * each one occupies on `Material Categories` and in the committed CSV.
 *
 * The codes are `singleLineText` and never `number`: 427 of the 777 rows carry a
 * leading zero at every level (`01`, `0101`, `0101001`, `0101001001`), and a
 * numeric column silently drops it, which would make `01` and `1` the same
 * category and misfile everything under it.
 */
export const CATEGORY_LEVELS = Object.freeze([
    Object.freeze({ code: "Level 1 Code", name: "Level 1 Category" }),
    Object.freeze({ code: "Level 2 Code", name: "Level 2 Category" }),
    Object.freeze({ code: "Level 3 Code", name: "Level 3 Category" }),
    Object.freeze({ code: "Level 4 Code", name: "Level 4 Category" }),
]);

/**
 * The leaf level's code is the natural key of a category row — unique across all
 * 777 — and the field `Materials."Category Code"` looks up in #356, since
 * `filterByFormula` cannot compare a link field against a record id.
 *
 * IT DOES NOT ENCODE ITS ANCESTORS. 11 of the 777 rows break prefix nesting
 * outright, so slicing this string is not a way to reach a parent; a category is
 * narrowed by its stored level columns and never by cutting a code. The offline
 * check asserts that non-nesting by count, so the day somebody reads these codes
 * as hierarchical they are told otherwise.
 */
export const CATEGORY_LEAF_CODE = CATEGORY_LEVELS[CATEGORY_LEVELS.length - 1].code;

/**
 * Between two segments of a composed label.
 *
 * ` > ` rather than ` / ` because 28 of the 770 distinct category names already
 * contain a spaced slash — `Bolts / Nuts / Washers`, `Slip On / RF`, `Machined /
 * Fabricated` — spread over 85 of the rows, so a slash-joined path reads as more
 * levels than it has: `Stainless Steel (SUS) / Pipe / SUS 304 / Machined /
 * Fabricated` is four levels wearing five. The 14 names carrying an unspaced
 * slash (`AP/MP`, `NBR/EPDM …`) never collide with either candidate.
 *
 * No name contains an angle bracket at all, so joining with this separator is
 * injective: two rows share a label only if they share all four segments, which
 * makes the uniqueness of the 777 labels a property of the separator rather than
 * a property of today's data.
 */
export const CATEGORY_LABEL_SEPARATOR = " > ";

/**
 * A level whose name is one of these adds nothing to the path and is dropped.
 * They are placeholders in HQ's tree rather than categories — `Standard` fires
 * 141 times and `Other` 51 across the four levels.
 */
export const CATEGORY_LABEL_SKIPPED = Object.freeze(["Standard", "Other"]);

/**
 * The composed label for one category row, keyed by the column names above.
 *
 * The first level is always kept; each following level is kept unless it is
 * blank, is one of the skipped words, or repeats THE SEGMENT LAST KEPT — not the
 * previous level, which may itself have been dropped. The two readings agree on
 * every one of the 777 rows committed today and diverge only on a path like
 * `PVC / Pipe / Standard / Pipe`, where the segment-last-kept reading gives
 * `PVC > Pipe` and the previous-level one gives `PVC > Pipe > Pipe`. This is the
 * reading the issue states, and it is also the one that cannot emit two
 * identical adjacent segments.
 */
export function composeCategoryLabel(row) {
    const kept = [];

    for (const level of CATEGORY_LEVELS) {
        const value = row[level.name];
        if (kept.length === 0) {
            kept.push(value);
            continue;
        }
        if (isDropped(value, kept[kept.length - 1])) continue;
        kept.push(value);
    }

    return kept.join(CATEGORY_LABEL_SEPARATOR);
}

/** Whether a following level adds nothing to the path. */
function isDropped(value, lastKept) {
    if (value === "" || value === undefined || value === null) return true;
    if (CATEGORY_LABEL_SKIPPED.includes(value)) return true;
    return value === lastKept;
}

// ---------------------------------------------------------------------------
// The same rule as an Airtable formula
// ---------------------------------------------------------------------------

const field = (name) => `{${name}}`;
const literal = (text) => `"${text}"`;

/**
 * The predicate `isDropped` above, over one level and an expression for the
 * segment last kept. Airtable has no variables, so `lastKept` arrives as a
 * whole expression and is substituted wherever it appears — which is why the
 * fourth level's clause is the long one.
 */
function droppedFormula(level, lastKept) {
    const value = field(level.name);
    const clauses = [
        `${value} = ""`,
        ...CATEGORY_LABEL_SKIPPED.map((word) => `${value} = ${literal(word)}`),
        `${value} = ${lastKept}`,
    ];
    return `OR(${clauses.join(", ")})`;
}

/** An expression for the segment last kept after level `index` is considered. */
function lastKeptFormula(index) {
    if (index === 0) return field(CATEGORY_LEVELS[0].name);
    const previous = lastKeptFormula(index - 1);
    const value = field(CATEGORY_LEVELS[index].name);
    return `IF(${droppedFormula(CATEGORY_LEVELS[index], previous)}, ${previous}, ${value})`;
}

/** What level `index` contributes to the label: nothing, or the separator and itself. */
function segmentFormula(index) {
    const level = CATEGORY_LEVELS[index];
    const dropped = droppedFormula(level, lastKeptFormula(index - 1));
    return `IF(${dropped}, "", ${literal(CATEGORY_LABEL_SEPARATOR)} & ${field(level.name)})`;
}

/**
 * `Material Categories."Category Label"`, as the base computes it.
 *
 * Applied by `scripts/import/create_material_categories_354.py`, which PATCHes
 * it onto the field — a formula field's `options.formula` PATCHes cleanly (200,
 * measured in #281), while the field cannot be CREATED as a formula at all, so
 * the field starts as text and is converted by hand once. See
 * `docs/notes/materials.md`.
 */
export const CATEGORY_LABEL_FORMULA = [
    field(CATEGORY_LEVELS[0].name),
    ...CATEGORY_LEVELS.slice(1).map((_, offset) => segmentFormula(offset + 1)),
].join("\n  & ");
