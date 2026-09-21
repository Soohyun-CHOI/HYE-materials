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
 * The readable name a category carries, as a person says it (#415) — the column
 * in the committed CSV and the `singleLineText` field the import fills from it.
 *
 * A STORED VALUE AND NOT A SECOND FORMULA, which is the whole difference between
 * this and `Category Label` beside it. The label is composed from the four level
 * columns by one rule, so a category added by hand gets one for free; these names
 * come from eight templates HQ writes them with — `Tube, SUS 304, AP` takes three
 * levels in order, `Tank Fabrication & Installation, Custom Fabrication &
 * Delivery` takes two out of order, and others append a word no level holds — so
 * no expression computes them and the CSV is the source. A path added by hand
 * therefore arrives with a label and WITHOUT one of these, which is a real
 * consequence rather than an oversight: `docs/notes/materials.md` records it.
 *
 * THE SAME NAME AS `Materials."Item Name"` ON PURPOSE. That field is a lookup
 * through `Category`, reading `Category Label` today, and #416 repoints it here —
 * so the source and the lookup end up carrying one name where they disagree now.
 *
 * `Material Categories` ALSO CARRIES A `Template` COLUMN IN THE CSV AND NOT IN THE
 * BASE. It records which of the eight shapes produced a name, which is provenance
 * for whoever maintains the catalog and not a value this app has any reading of.
 */
export const CATEGORY_ITEM_NAME = "Item Name";

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
    return keptCategorySegments(row).join(CATEGORY_LABEL_SEPARATOR);
}

/**
 * The segments the rule above keeps, before they are joined (#368).
 *
 * SPLIT OUT BECAUSE A SECOND READER WANTS THE SEGMENTS RATHER THAN THE LABEL.
 * `lib/categoryCreation.js:draftItemName` proposes an item name to whoever is
 * adding a path, and the shape HQ's most common template writes is this list
 * without its first element, joined with `, ` — so deriving the draft from here
 * means the draft and the label cannot disagree about which levels count. The
 * alternative was a second loop with the same three drop clauses in it, which is
 * the duplication CLAUDE.md's own section is about, and it would have drifted the
 * first time one of the clauses moved.
 *
 * `composeCategoryLabel`'s behavior is unchanged by the split and
 * `offline/material-categories.mjs` pins it by value on seven paths, so a
 * regression here fails that check rather than this one.
 */
export function keptCategorySegments(row) {
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

    return kept;
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
 * Applied by `scripts/import/create_material_categories_354.mjs`, which PATCHes
 * it onto the field — a formula field's `options.formula` PATCHes cleanly (200,
 * measured in #281), while the field cannot be CREATED as a formula at all, so
 * the field starts as text and is converted by hand once. See
 * `docs/notes/materials.md`.
 */
export const CATEGORY_LABEL_FORMULA = [
    field(CATEGORY_LEVELS[0].name),
    ...CATEGORY_LEVELS.slice(1).map((_, offset) => segmentFormula(offset + 1)),
].join("\n  & ");

// ---------------------------------------------------------------------------
// Narrowing the tree, for the form that walks it (#355)
//
// THE MODULE'S SUBJECT WIDENED HERE AND THE HEADER ABOVE SAYS ONLY "the label".
// #354 shipped the label rule; #355 needs the walk, and the walk belongs beside
// it rather than in a module of its own for one measured reason: the request
// form is a Client Component, so whatever it imports must reach nothing under
// `lib/airtable/` at any depth (CLAUDE.md, client bundle safety). This file
// imports nothing at all, which is what makes it importable from both sides —
// splitting the walk out would produce a second such file with the same
// property and no second subject.
// ---------------------------------------------------------------------------

/**
 * One category, in the shape the form and the walk below use.
 *
 * `recordId` is what a `PR Items."Category"` link is written with; the codes are
 * what NARROWS and the names are what is SHOWN, and those are deliberately not
 * the same array. 25 level-2 names are carried by more than one level-1 branch —
 * `Pipe` is under a dozen materials — so narrowing on a name would pull rows in
 * from branches the requester did not choose. A code has exactly one parent at
 * every level, measured across all 777 rows with 0 violations.
 */
export function toCategory(record) {
    return {
        recordId: record.id,
        label: record.label,
        // #416 — the readable name, which is what a document freezes now. It rides
        // beside the label rather than replacing it: the label is still what
        // `/materials` matches a search against, and `composeCategoryLabel` is
        // still the rule the base is checked against.
        itemName: record.itemName ?? "",
        codes: CATEGORY_LEVELS.map((l) => record[l.code] ?? ""),
        names: CATEGORY_LEVELS.map((l) => record[l.name] ?? ""),
    };
}

/**
 * What each level may offer given the codes chosen above it, and which category
 * a complete set of choices resolves to.
 *
 * `chosen` is up to four codes, outermost first, with a blank for a level nobody
 * has picked yet. A level whose parent is unpicked offers nothing — the form
 * cannot ask for a discipline of a job that has not been named.
 *
 * A CHOICE THE TREE NO LONGER HAS IS DROPPED, AND EVERYTHING UNDER IT WITH IT.
 * That is not defensive coding for its own sake: a Draft saved before this
 * issue carries no category at all, and one saved after it can be re-opened
 * after somebody adds or corrects a path directly in Airtable — which
 * `docs/notes/materials.md` records as how a path arrives. Silently keeping a
 * stale code would offer a fourth level under a branch that is gone.
 */
export function narrowCategories(categories, chosen) {
    const picked = [];
    const levels = [];
    let rows = categories || [];

    for (let i = 0; i < CATEGORY_LEVELS.length; i++) {
        const options = [];
        const seen = new Set();
        for (const category of rows) {
            const code = category.codes[i];
            if (code === "" || seen.has(code)) continue;
            seen.add(code);
            options.push({ code, name: category.names[i] });
        }

        const want = chosen?.[i] ?? "";
        const valid = want !== "" && seen.has(want);
        levels.push({ options, chosen: valid ? want : "" });
        if (!valid) {
            // Nothing below a level nobody has settled: the remaining levels are
            // reported empty rather than omitted, so a caller can render four
            // controls without counting.
            for (let rest = i + 1; rest < CATEGORY_LEVELS.length; rest++) {
                levels.push({ options: [], chosen: "" });
            }
            picked.length = 0;
            return { levels, selected: null, complete: false };
        }

        picked.push(want);
        rows = rows.filter((category) => category.codes[i] === want);
    }

    // Every leaf code is distinct across the tree, so a complete set of four
    // narrows to exactly one row. `?? null` rather than `rows[0]` alone because a
    // caller can hand in a subset of the tree.
    return { levels, selected: rows[0] ?? null, complete: rows.length === 1 };
}

// `chosenCodesFor` STOOD HERE AND IS GONE (#182). It turned a stored category
// into the four codes the walk accepts, and no form ever called it: both seed
// their rows from a `Map` of record id → codes and spell the fallback inline as
// `…?.slice() ?? ["", "", "", ""]`, which is the same four blanks from a value
// this function's signature does not take. So giving it a caller would have meant
// redesigning the helper inside an audit, and what it covered is covered — by
// `PRForm.js` and `EditAndContinueForm.js`, identically. **That the two spell it
// twice is a real residual and is deliberately not fixed here**: it is a default
// value rather than a rule, which is the boundary #183 drew, and `materials.md`
// records it for the next pass over this module.

/**
 * One level picked, with every deeper level cleared (#355, moved here by #367).
 *
 * THE CLEARING IS THE RULE AND IT LIVED IN A FORM. The levels are not four
 * independent fields: changing the second one means the third and fourth were
 * chosen inside a branch that is no longer the one being looked at, so leaving
 * them set carries a choice from one branch into another. `narrowCategories`
 * would drop them anyway — it refuses a code its level does not offer — so this
 * keeps the state and the display saying the same thing rather than relying on
 * the reader to re-derive it.
 *
 * IT MOVED BECAUSE A SECOND SCREEN NEEDED IT. #355 wrote it as
 * `PRForm.js:updateItemCategory`, which was right while one form picked a
 * category; #367 gives the signer's edit form the same picker, and a rule spelled
 * twice is the duplication CLAUDE.md's own section is about. Being here rather
 * than in the shared component is what lets the offline tier call it — a
 * `"use client"` file is not importable under plain `node`.
 *
 * Always returns four codes, whatever arity it was handed, so a caller cannot
 * shorten the array by picking into a row it built itself.
 */
export function pickCategoryLevel(chosen, level, code) {
    const codes = CATEGORY_LEVELS.map((_, i) => chosen?.[i] ?? "");
    codes[level] = code;
    for (let deeper = level + 1; deeper < codes.length; deeper++) codes[deeper] = "";
    return codes;
}

/**
 * The two fields a picked category writes, together (#367).
 *
 * `Item Name` IS WRITTEN FROM THE CATEGORY AND THE PAIR IS ONE EXPRESSION, which
 * is this function's whole reason to exist. #355 made the name a frozen copy and
 * stopped offering it as free text; the guarantee was a screen's, though, and the
 * two writes stayed two statements at two call sites — the request form's save
 * and, since #367, the signing chain's edit turn. Pairing them here makes "the two
 * cannot disagree" a property of the code rather than of whoever writes the next
 * call site, and `offline/category-picker.mjs` holds that no call site assigns an
 * item name from a category any other way.
 *
 * **WHICH FIELD IT COPIES CHANGED IN #416 AND THE PAIRING IS WHY THAT WAS ONE
 * EDIT.** It froze `Category Label`, the composed path, so a purchase order sent a
 * vendor `Stainless Steel (SUS) > Tube > SUS 304 > AP`; it freezes
 * `Material Categories."Item Name"` now, which is `Tube, SUS 304, AP`. Both screens
 * followed because both go through here — the property #367 built this for, paying
 * off on the first change to the value since.
 *
 * Nothing normalizes it: `createItem`/`updateItem` run `normalizeItemText` on the
 * way in as they always have, and the CSV the name is imported from carries no
 * leading, trailing or doubled whitespace (`offline/material-categories.mjs`).
 */
export function categoryItemFields(category) {
    return { categoryRecordId: category.recordId, itemName: category.itemName };
}

/**
 * Whether an edit turn may save this row's category as it stands (#367).
 *
 * THE RULE IS NOT THE REQUEST FORM'S, AND THE DIFFERENCE IS DELIBERATE.
 * `createPRAction` refuses any item without a category, because a request being
 * submitted is the moment every row has to be complete. An edit turn is later
 * than that moment: the request is already in review, and a signer who cannot
 * pick a category for a row somebody else raised would be unable to edit a
 * request they can still approve outright — Approve touches no item. So a row
 * that arrived without a category and was left alone passes, and the refusal is
 * about the PICK rather than about the row: finish what you started.
 *
 * `hadCategory` is what makes clearing one a refusal rather than a silent
 * revert. Blanking the first level empties the four codes, which without this
 * clause would read as "untouched" and save the stored category back under a
 * screen showing nothing picked.
 *
 * `resolved` is the answer from the base rather than from the tree — the action
 * holds no tree, and a leaf code resolves through `getCategoriesByLeafCode`. A
 * code the catalog has since lost therefore lands here as unresolved, which is
 * the same refusal and the same instruction.
 */
export function refuseUnsettledCategory({ chosen, hadCategory, resolved }) {
    if (resolved) return null;
    if (!(chosen || []).some(Boolean) && !hadCategory) return null;
    return CATEGORY_PICKER_COPY.unsettled;
}

// ---------------------------------------------------------------------------
// Copy
//
// In a constant rather than in the form's JSX, because `offline/`'s vocabulary
// and item-noun checks walk copy constants and cannot see text inside a
// component — the gap `docs/briefs/strings/README.md` measures.
// ---------------------------------------------------------------------------

export const CATEGORY_PICKER_COPY = {
    /**
     * One label per level. The tree's own words rather than invented ones: HQ
     * calls these levels and the columns are `Level 1 Category` … `Level 4
     * Category`, so a requester asking the office what to pick and a person
     * reading the base are looking at the same four names.
     */
    levels: CATEGORY_LEVELS.map((_, i) => `Level ${i + 1}`),

    /** Shown on a level whose parent is unpicked, so the control is never blank and silent. */
    awaitingParent: (i) => ({
        key: `awaiting-level-${i}`,
        text: i === 0 ? "Pick a category." : `Pick level ${i} first.`,
    }),

    /**
     * The item's name, beside the four choices that produced it.
     *
     * IT IS SHOWN RATHER THAN INFERRED FROM THE PICKERS, and that is a fact about
     * the rule rather than a courtesy: the requester's four choices and the string
     * the vendor reads on the purchase order are not the same text, and this is
     * the only place the second one is visible before the order is placed.
     *
     * **THE ARGUMENT SURVIVED #416 AND GOT STRONGER, WHICH IS WHY THE LINE STAYS
     * AND ITS SUBJECT MOVED.** It showed `Category Label`, and the gap it existed
     * for was that the label drops `Standard` and `Other` and folds a level
     * repeating the one kept before it, so 27% of complete paths read as fewer than
     * four segments. What a vendor reads is the category's item name now, and HQ
     * writes those with eight templates — three levels in order, two out of order,
     * or a word no level holds — so it is derivable from the four choices even less
     * often than the label was.
     *
     * **AND THE PATH LEAVES THIS LINE RATHER THAN JOINING THE NAME ON IT.** The
     * four controls directly above say which branch the requester is in, so the
     * path here would restate them; what they cannot say is the one string this
     * screen exists to preview. Where the path belongs on a screen is the design
     * pass's, and no document screen carries one after #416.
     */
    resolved: (itemName) => ({ key: "resolved-category", text: itemName }),

    /** A row that has not settled all four levels, refused at submit. */
    incomplete: {
        key: "category-incomplete",
        text: "Every item needs all four levels of its category picked.",
    },

    /**
     * The same state one screen over, refused when a signing turn is saved
     * (#367) — and a second sentence rather than the one above, because the two
     * screens enforce different rules. `refuseUnsettledCategory` says why: an
     * edit turn lets a row that never had a category through, so `Every item
     * needs…` would be a false description of what this screen does.
     */
    unsettled: {
        key: "category-unsettled",
        text: "Pick all four levels of an item's category before saving.",
    },

    /**
     * A row stored before the catalog existed. Says what to do rather than what
     * went wrong: the person did nothing, and the row is one pick away from
     * being usable again.
     *
     * IT IS FOR A ROW WITH NO STORED CATEGORY AND NOTHING ELSE, which #367 had
     * to make explicit because the condition in front of it was wider than the
     * sentence. `PRForm.js` showed this whenever nothing was picked and a name
     * survived — including a row whose category the reader had just cleared,
     * which is a row saved well AFTER the catalog and was being told otherwise.
     * Reachable on `/prs/new` today by clearing the first level of a hydrated
     * draft; the signer's form makes it the ordinary way to change an item, so
     * the two states are told apart and `cleared` is the other one.
     */
    fromBeforeTheCatalog: {
        key: "category-missing",
        text: "This item was saved before the catalog. Pick its category to continue.",
    },

    /**
     * A row whose stored category was cleared in this session (#367).
     *
     * It names what the item WAS, because that is the only copy of it left on
     * screen once the four pickers are empty — the picker cannot offer an undo,
     * and the stored path is what the reader needs to find their way back to it
     * or to a neighbouring one.
     */
    cleared: (name) => ({
        key: "category-cleared",
        text: `This item was ${name}. Pick all four levels again.`,
    }),
};
