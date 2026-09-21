// Adding a path to the catalog from the app (#368) — the pure half of the first
// write screen the item axis has: which parent a leaf hangs off, what its codes
// are, what a level with nothing under it stores, the name a document will print,
// and every word the screen says.
//
// WHY THE SCREEN EXISTS AT ALL. A path HQ's tree does not have is added by hand in
// Airtable, which puts four codes, four names and an item name in a person's
// typing. Three of those have rules — the leaf code has to be unique across the
// whole table, it has to sit under the parent it names, and it has to take the 900
// block that marks a path this office added rather than one HQ sent — and the rules
// were held nowhere but in a note and in the field's own description. A broken leaf
// code prints the wrong path on a vendor's purchase order, and since #416 a
// duplicated item name makes two materials answer to one name on every screen.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE FORM. That is lib/toolRegistration.js's
// and lib/addressCreation.js's shape and it is why this module exists rather than
// the rules living in the action: the person adding a path has to see the name a
// document will print and the place the row will sit BEFORE they submit, and the
// server has to reach the same verdict afterwards from data the browser cannot
// vouch for. `planCategory` is the one judgment and both callers run it.
//
// THE CODES ARE COMPUTED AND THE NAME IS NOT, WHICH IS THE WHOLE DIVISION OF LABOR
// HERE. A code is mechanical (see `nextBranchCode`) and a name is not: #415
// measured that HQ writes these with eight templates, so no expression produces
// them, which is why `Material Categories."Item Name"` is a stored value where
// `Category Label` is a formula. So the form DRAFTS the name from the levels and
// the person types over it; `draftItemName` reproduces 347 of the 777 committed
// names and that is what a draft is worth.
//
// PURE AND OFFLINE-SAFE. It imports `./materialCategory.js` and `./itemNaming.js`
// with the extension spelled out, which is the lib/addressCreation.js precedent
// (#19, #338, #384): the offline tier runs under plain `node` with no loader, and
// the alternative was a second copy of the label rule and of #18's naming rule.
// Nothing here reaches lib/airtable/, so the form can import it — an import is an
// execution, and a credentialed module in a "use client" file is a browser crash
// rather than a lint error.
//
// EVERY STRING THE SCREEN RENDERS IS IN `CATEGORY_CREATION_COPY` AND NONE IS IN
// JSX. A word written into a component is invisible to the vocabulary checks and to
// scripts/screen-strings.mjs, whose `COPY_NAME` matcher finds a constant by NAME —
// so a screen with copy in its markup cannot be swept. The three `/admin` create
// forms spell their labels straight into JSX and are the pattern this screen
// otherwise follows; that half of the pattern is deliberately not copied.
//
// IT NARROWS THE TREE HERE RATHER THAN IN THE FORM, AND THAT IS NOT INCIDENTAL.
// `offline/category-picker.mjs` holds by exact equality that ONE file under `app/`
// calls `narrowCategories`, and it is `app/components/CategoryPicker.js` — #367's
// property that the two item screens cannot drift apart. This screen picks a
// PARENT rather than an item, so it does not render that component; putting its
// narrowing in `narrowParent` keeps that equality true by construction and leaves
// the walk callable from the offline tier.

import { normalizeItemText, textMatchKey } from "./itemNaming.js";
import {
    CATEGORY_ITEM_NAME,
    CATEGORY_LABEL_SKIPPED,
    CATEGORY_LEVELS,
    CATEGORY_PICKER_COPY,
    composeCategoryLabel,
    keptCategorySegments,
    narrowCategories,
} from "./materialCategory.js";

// ---------------------------------------------------------------------------
// The 900 block
// ---------------------------------------------------------------------------

/**
 * The first three-digit tail a path this office adds may take, appended to the
 * parent's own code: `0101002` becomes `0101002901`.
 *
 * THE MARGIN IS MEASURED AND THE PREMISE IS ASSERTED ELSEWHERE. HQ's own highest
 * last-three is 033 across all 777 committed leaves and none of its level-3 or
 * level-4 codes reaches the block at all — `offline/material-categories.mjs` holds
 * that as the PREMISE this convention rests on, and it fails the day an import
 * from HQ reaches into the range, which is the moment to re-decide rather than a
 * moment to paper over. Re-read on the live base while #368 was open: 0 of 777
 * leaf tails and 0 of 777 level-3 tails are 900 or above.
 *
 * WHY THE BLOCK IS WORTH FOLLOWING AT ALL (#355): HQ's tree is re-received
 * periodically, and after a re-import the code is the only thing that can tell a
 * branch-made path from an HQ one — Korean names are deliberately not stored and
 * the mapping workbook's KR-EN sheet is keyed on codes. A `Source` field was
 * weighed and refused, because a blank on 777 imported rows would mean "HQ" only
 * by convention.
 *
 * IT REACHES LEVELS 3 AND 4 AND STOPS THERE, WHICH IS WHAT PUTS THIS SCREEN'S
 * SCOPE WHERE IT IS. The codes are 2, 4, 7 and 10 digits, so a level-3 or level-4
 * code's tail is three digits and a level-2 code's is two — and HQ already uses
 * the 9 range at level 2 (`9591`, `9593`, `9594`, `9595`, `9797`, read off the
 * base). So a new level 1 or level 2 has no free block to take and is not this
 * screen's to add.
 */
export const BRANCH_CODE_FLOOR = 901;

/**
 * The last, and a refusal rather than a wider code.
 *
 * THE WIDTH IS THE CONVENTION'S CARRIER, which is why running out is a sentence
 * and not a fourth digit. `Level 4 Code` is ten digits on all 777 rows and
 * `offline/material-categories.mjs` asserts that per level, so an eleven-digit
 * code would break the assertion that makes the codes readable as text at all.
 * Unreachable in practice — 99 slots under every parent, against HQ's own 33 —
 * and the alternative to refusing is writing a shape nothing else on the base has.
 */
export const BRANCH_CODE_CEILING = 999;

/** The digits a level-3 or level-4 code adds to its parent's. */
export const BRANCH_CODE_WIDTH = 3;

/**
 * The next code under `parentCode`, or the refusal.
 *
 * ONE FUNCTION FOR BOTH, so no call site can read the code without having
 * consulted the refusal — `readQuantity`'s and `readAddressFields`' shape.
 *
 * HIGHEST + 1 WITHIN THE BLOCK, WHICH IS `nextSequence`'s RULE AND NOT A NEW ONE.
 * A gap in the middle is a free number rather than a wrong record, and stepping
 * over it is cheaper than reusing one: a leaf code is what `Materials."Category
 * Code"` looks up, so re-issuing a code a deleted row once had would point a
 * material's identity at a category that is not the one it was keyed on. Codes
 * below the floor are HQ's and are not counted — the block is numbered
 * independently of whatever HQ put under the same parent.
 *
 * THE TAIL IS THE LAST THREE DIGITS RATHER THAN THE DIFFERENCE FROM THE PARENT,
 * because a code does not encode its ancestors: 11 of the 777 rows break prefix
 * nesting, 2 of them at the leaf. So a sibling is read for the number it carries
 * in its own last three digits, which is the level's number within its parent
 * whether or not the prefix agrees.
 *
 * AND FREE AMONG SIBLINGS IS NOT FREE ACROSS THE TABLE, which is the reason the
 * write path re-asks the base for the computed code rather than trusting this.
 * The same 11 rows are why: a code minted from one parent's children can in
 * principle already be carried by a row filed under another. See
 * `createCategoryUnderLevel2`.
 */
export function nextBranchCode(parentCode, siblingCodes) {
    const parent = String(parentCode ?? "");
    if (!/^\d+$/.test(parent)) {
        throw new Error(`nextBranchCode: a parent code is digits, got ${JSON.stringify(parentCode)}`);
    }

    const taken = (siblingCodes || [])
        .map((code) => String(code ?? "").slice(-BRANCH_CODE_WIDTH))
        .filter((tail) => /^\d+$/.test(tail))
        .map(Number)
        .filter((tail) => tail >= BRANCH_CODE_FLOOR);

    const next = taken.length === 0 ? BRANCH_CODE_FLOOR : Math.max(...taken) + 1;
    if (next > BRANCH_CODE_CEILING) {
        return { code: null, refusal: CATEGORY_CREATION_COPY.codesExhausted(parent) };
    }
    // No padding: the floor is three digits, so every value the block can take is.
    return { code: `${parent}${next}`, refusal: null };
}

// ---------------------------------------------------------------------------
// A level with nothing under it
// ---------------------------------------------------------------------------

/**
 * What a level marked as having no division below it stores.
 *
 * ONE WORD WHERE THE CATALOG HAS TWO, AND THE SCREEN SAYS NEITHER. 126 of the 777
 * rows fill level 3 or level 4 with `Standard` or `Other` and the label formula
 * drops both; nothing in the data says how the two differ, so what this office
 * writes is `Standard` alone. **The form does not ask anybody to choose the
 * word** — `CATEGORY_CREATION_COPY.noDivision` asks for the meaning, which is what
 * the word actually carries, and the preview shows the level leaving the path.
 *
 * AN EXISTING SKIP-WORD SIBLING IS REUSED RATHER THAN JOINED BY A SECOND ONE.
 * `resolveLevel3` matches a no-division mark against either of
 * `CATEGORY_LABEL_SKIPPED`, so a parent that already carries HQ's `Other` does not
 * gain a `Standard` beside it: both drop out of the label, so two of them would be
 * two options a requester cannot tell apart in the level-3 picker — the defect the
 * measurement below exists against.
 *
 * MEASURED, AND IT IS WHAT THE WHOLE RESOLVE-OR-MINT RULE RESTS ON: no parent in
 * the committed tree carries two children of the same name, at any of the three
 * levels (0 of 225 level-2 parents, 0 of 513 level-3 parents, 0 at level 1). The
 * picker narrows on the CODE and shows the NAME, so this app must not be the thing
 * that ends that.
 */
export const NO_DIVISION_NAME = "Standard";

/** Whether a level's name is one the label drops — a level with nothing under it. */
export function isNoDivisionName(name) {
    return CATEGORY_LABEL_SKIPPED.some((word) => textMatchKey(word) === textMatchKey(name));
}

// ---------------------------------------------------------------------------
// The item name
// ---------------------------------------------------------------------------

/** Between two segments of a drafted item name. */
export const ITEM_NAME_SEPARATOR = ", ";

/**
 * The name to propose, from the four level names.
 *
 * READ OUT OF THE COMMITTED CSV RATHER THAN INVENTED. That file carries a
 * `Template` column recording which of eight shapes HQ wrote each name with, and
 * the most common — 360 of 777 rows — is the level names below the first, joined
 * with `, `, with the same three clauses the label rule drops: a blank, a
 * placeholder word, and a repeat of the segment last kept. So the draft is
 * `keptCategorySegments` without its first element, which is why the two cannot
 * disagree about which levels count.
 *
 * MEASURED AGAINST THE 777: it reproduces the stored name on **347**, and on 285
 * of the 360 written with that template (27 of 27 of template E, 22 of 63 of F).
 * **That is exactly why it is a draft and not a computation** — 430 names are not
 * what any rule produces, which is #415's own finding and the reason the field is
 * stored. The form mirrors this into the box until the person types, and after
 * that the box is theirs.
 *
 * IT CAN BE EMPTY, on 12 of the 777: a path whose label collapses to one segment
 * has nothing below level 1 to draft from — `PFA > Other > Standard > Standard`
 * is a real row. The form then opens the box empty rather than showing a name
 * nobody would keep.
 */
export function draftItemName(names) {
    return keptCategorySegments(rowFromNames(names)).slice(1).join(ITEM_NAME_SEPARATOR);
}

/** The composed path these four names produce, by the rule the base computes. */
export function categoryLabelFor(names) {
    return composeCategoryLabel(rowFromNames(names));
}

/** The four names in the shape the label rule reads. */
function rowFromNames(names) {
    return Object.fromEntries(CATEGORY_LEVELS.map((level, i) => [level.name, (names || [])[i] ?? ""]));
}

/**
 * The key two typed item names have to share to be one name.
 *
 * `addressLabelKey`'S AND `toolNameKey`'S READING, one table over, and it calls the
 * same composition for the same reason: whitespace is fixed in the STORED value
 * because a formula cannot collapse an internal run, and case is folded only in
 * the COMPARISON because the stored string is the only copy of what somebody
 * typed — `SUS 304`, `AP` and `RF 3.0T` are correct as written, and this string is
 * printed on the purchase order a vendor reads.
 *
 * Its Airtable counterpart is `LOWER(TRIM({Item Name}))`, which
 * `getCategoryByItemName` makes. Measured in #338 and unchanged here: Airtable's
 * `=` on a text field is case-SENSITIVE, so the lookup cannot be a bare `=`.
 *
 * FOLDING CASE COSTS NOTHING ON TODAY'S DATA AND THAT WAS CHECKED RATHER THAN
 * ASSUMED: the base's 777 item names are distinct under this key as well as
 * exactly, so the comparison admits no pair of existing rows.
 */
export function categoryNameKey(itemName) {
    return textMatchKey(itemName);
}

/**
 * The category an already-loaded tree holds under this item name, or null.
 *
 * The form's preview and nothing else — the ACTION asks Airtable, because a tree
 * the browser loaded moments ago cannot answer whether a name is taken now. So
 * this is the same key reaching the same verdict on stale data, which is what
 * makes the preview honest without making it authoritative.
 */
export function matchExistingCategoryName(itemName, categories) {
    const key = categoryNameKey(itemName);
    if (!key) return null;
    return (categories || []).find((category) => categoryNameKey(category.itemName) === key) || null;
}

// ---------------------------------------------------------------------------
// The parent, and what each control may offer
// ---------------------------------------------------------------------------

/**
 * The two choices a level-3 control offers besides the parent's own children.
 *
 * Non-numeric on purpose: a level-3 code is seven digits, so neither sentinel can
 * collide with one, and the action reads a submitted value as a code only when it
 * is neither of these.
 */
export const LEVEL_CHOICE = Object.freeze({ newLevel: "new-level", noDivision: "no-division" });

/**
 * What the parent controls may offer, given the codes chosen above them.
 *
 * `narrowCategories` DOES THE WALK AND THIS NAMES THE HALF THIS SCREEN USES: two
 * levels to pick a parent with, the level-3 children that parent already has, and
 * — once a level 3 is settled — the level-4 names already under it, which the form
 * shows so nobody types one that exists. See this module's header for why the call
 * is here and not in the form.
 *
 * `chosen` is up to three codes, outermost first, with a blank for a level nobody
 * has picked. A level-3 SENTINEL is not a code, so a caller passes a blank for it
 * and the fourth level comes back empty — which is correct: a level 3 that does
 * not exist yet has no children to collide with.
 */
export function narrowParent(categories, chosen) {
    const codes = [0, 1, 2].map((i) => {
        const code = (chosen || [])[i] ?? "";
        return Object.values(LEVEL_CHOICE).includes(code) ? "" : code;
    });
    const walk = narrowCategories(categories, [...codes, ""]);
    return {
        levels: walk.levels.slice(0, 3),
        level4Names: walk.levels[3].options.map((option) => option.name),
    };
}

/** Every row of an already-loaded tree that sits under one level-2 code. */
function rowsUnderLevel2(categories, level2Code) {
    if (!level2Code) return [];
    return (categories || []).filter((category) => category.codes[1] === level2Code);
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/**
 * Everything one submission means, or the refusal — the whole judgment, run by
 * the form against the tree it loaded and by the action against rows it read
 * inside the lock.
 *
 * `rows` HAS TO CONTAIN EVERY ROW UNDER THE CHOSEN LEVEL 2 and may contain more:
 * the form hands it the whole tree and the action hands it one query's worth, and
 * both are filtered here so the two callers cannot narrow differently. An unknown
 * level-2 code therefore lands as `parentUnknown`, which is also the forged-call
 * guard — a Server Action is directly callable and the control constrains a
 * person, not a caller.
 *
 * THE ORDER OF THE REFUSALS IS THE ORDER A READER CAN ACT ON. Missing fields
 * first, because nothing else can be judged without them; then the parent; then
 * the path, because "this already exists" is a fact about the whole submission and
 * makes the name question moot; then the codes. The NAME's own collision is not
 * here at all — it is a question about the whole table, which this function is not
 * given, and the write path asks it under the lock.
 */
export function planCategory(fields, rows) {
    const values = readFields(fields);

    const missing =
        !values.level1Code ||
        !values.level2Code ||
        !values.level3Choice ||
        (values.level3Choice === LEVEL_CHOICE.newLevel && !values.level3Name) ||
        (!values.level4NoDivision && !values.level4Name) ||
        !values.itemName;
    if (missing) return { plan: null, refusal: CATEGORY_CREATION_COPY.fieldsMissing };

    const resolved = resolveCategoryNames(values, rows);
    if (!resolved) return { plan: null, refusal: CATEGORY_CREATION_COPY.parentUnknown };
    const { siblings, level3, names } = resolved;

    // A LEVEL-4 SIBLING THAT MATCHES IS THE PATH ITSELF, NOT A CHOICE, and that
    // asymmetry with level 3 is the shape of this screen: at level 3 an existing
    // child is what the new leaf hangs off, and at level 4 it means the row is
    // already there. Two rows with all four names equal would also carry one
    // label, and the 777 labels are distinct.
    const under = level3.code ? siblings.filter((row) => row.codes[2] === level3.code) : [];
    const existing = under.find((row) =>
        values.level4NoDivision
            ? isNoDivisionName(row.names[3])
            : categoryNameKey(row.names[3]) === categoryNameKey(names[3])
    );
    if (existing) return { plan: null, refusal: CATEGORY_CREATION_COPY.pathExists(existing.label) };

    // The level-3 code first, because the leaf's is numbered inside it. A level 3
    // nobody has yet has no children, so its leaf is always the floor.
    let level3Code = level3.code;
    if (!level3Code) {
        const minted = nextBranchCode(values.level2Code, siblings.map((row) => row.codes[2]));
        if (minted.refusal) return { plan: null, refusal: minted.refusal };
        level3Code = minted.code;
    }
    const leaf = nextBranchCode(level3Code, under.map((row) => row.codes[3]));
    if (leaf.refusal) return { plan: null, refusal: leaf.refusal };

    return {
        plan: {
            codes: [values.level1Code, values.level2Code, level3Code, leaf.code],
            names,
            level3IsNew: !level3.code,
            itemName: values.itemName,
            label: categoryLabelFor(names),
        },
        refusal: null,
    };
}

/**
 * The four names a submission means, and the level 3 it resolves to — or null
 * when the parent is not in the rows it was given.
 *
 * SPLIT OUT OF THE PLAN BECAUSE THE FORM NEEDS THE NAMES BEFORE THERE IS A PLAN,
 * and that is not a convenience: the item name is DRAFTED from these four, so a
 * form that could only reach them through `planCategory` would have to wait for a
 * name to exist before it could propose one. It takes no item name for the same
 * reason.
 *
 * WHAT IT REMOVES IS A SECOND RESOLUTION. Which level 3 a typed name lands on, and
 * what a mark stores, are decisions with measurements behind them — the form
 * deriving its own answer for the draft and the preview would be that rule twice,
 * and the two would differ over exactly the submission nobody thinks to test.
 */
export function resolveCategoryNames(fields, rows) {
    const values = readFields(fields);
    if (!values.level1Code || !values.level2Code || !values.level3Choice) return null;

    const siblings = rowsUnderLevel2(rows, values.level2Code);
    const parent = siblings.find((row) => row.codes[0] === values.level1Code);
    if (!parent) return null;

    const level3 = resolveLevel3({
        choice: values.level3Choice,
        typed: values.level3Name,
        siblings,
    });
    if (level3.refusal) return null;

    return {
        siblings,
        level3,
        names: [
            parent.names[0],
            parent.names[1],
            level3.name,
            values.level4NoDivision ? NO_DIVISION_NAME : values.level4Name,
        ],
    };
}

/**
 * One submission's values, normalized.
 *
 * THE THREE TYPED STRINGS GO THROUGH #18's RULE ON THE WAY IN — trim and collapse
 * internal runs, case untouched — because the committed tree carries no leading,
 * trailing or doubled whitespace in any of its 3,108 name cells and nothing on the
 * Airtable side can collapse a run. Two names and the leaf name are stored, so
 * this is the write side of the invariant `offline/material-categories.mjs` holds
 * over the CSV.
 */
function readFields(fields) {
    return {
        level1Code: String(fields?.level1Code ?? ""),
        level2Code: String(fields?.level2Code ?? ""),
        level3Choice: String(fields?.level3Choice ?? ""),
        level3Name: normalizeItemText(fields?.level3Name),
        level4NoDivision: Boolean(fields?.level4NoDivision),
        level4Name: normalizeItemText(fields?.level4Name),
        itemName: normalizeItemText(fields?.itemName),
    };
}

/**
 * Which level 3 the leaf hangs off: one the parent already has, or one to mint.
 *
 * RESOLVE-OR-MINT RATHER THAN ALWAYS MINT, AND THE MEASUREMENT DECIDES IT. The
 * requester's picker narrows on the CODE and shows the NAME, and no parent in the
 * committed tree carries two children of one name — so minting a second
 * `Pipe Hanger` under one level 2 would put two options a requester cannot tell
 * apart in front of them, and the link would point at whichever the picker's
 * tie-break kept. A name that matches a sibling therefore takes that sibling's
 * code, which is a READ rather than an arithmetic and is the one place a code on
 * this screen is not computed.
 *
 * A MARK MATCHES EITHER PLACEHOLDER AND WRITES ONLY ONE. See `NO_DIVISION_NAME`.
 */
function resolveLevel3({ choice, typed, siblings }) {
    if (choice === LEVEL_CHOICE.noDivision) {
        const existing = siblings.find((row) => isNoDivisionName(row.names[2]));
        return existing
            ? { code: existing.codes[2], name: existing.names[2], refusal: null }
            : { code: null, name: NO_DIVISION_NAME, refusal: null };
    }

    if (choice !== LEVEL_CHOICE.newLevel) {
        const picked = siblings.find((row) => row.codes[2] === choice);
        if (!picked) return { code: null, name: "", refusal: CATEGORY_CREATION_COPY.parentUnknown };
        return { code: picked.codes[2], name: picked.names[2], refusal: null };
    }

    // A typed name that is already a sibling's joins it rather than coining a
    // second code for one name — the same rule the mark above obeys.
    const existing = siblings.find((row) => categoryNameKey(row.names[2]) === categoryNameKey(typed));
    if (existing) return { code: existing.codes[2], name: existing.names[2], refusal: null };
    return { code: null, name: typed, refusal: null };
}

/**
 * The record one plan writes, keyed by field name.
 *
 * DERIVED FROM `CATEGORY_LEVELS` RATHER THAN SPELLED, so the eight level fields
 * and the code-with-its-own-name pairing cannot be transcribed wrongly at the one
 * call site that writes them — #367's `categoryItemFields` argument over nine
 * fields instead of two.
 *
 * `Category Label` IS STRUCTURALLY ABSENT AND THAT IS THE POINT. It is a formula,
 * so the base computes every label and nothing in this repository has ever written
 * one; a payload carrying it would be refused by Airtable, and a payload that
 * could carry it is a payload somebody can put a typed path in.
 */
export function categoryRecordFields(plan) {
    return {
        ...Object.fromEntries(
            CATEGORY_LEVELS.flatMap((level, i) => [
                [level.code, plan.codes[i]],
                [level.name, plan.names[i]],
            ])
        ),
        [CATEGORY_ITEM_NAME]: plan.itemName,
    };
}

// ---------------------------------------------------------------------------
// Copy
//
// In a constant rather than in the page's JSX, for the reason in the header.
// ---------------------------------------------------------------------------

export const CATEGORY_CREATION_COPY = {
    heading: "New Category",
    intro: "A path the catalog does not have yet, under a level 2 it already has.",

    /**
     * The tree's own words, read from the picker's constant rather than written
     * again — HQ calls these levels and the columns are `Level 1 Category` …
     * `Level 4 Category`, so the office adding a path and the person reading the
     * base are looking at the same four names.
     */
    levels: CATEGORY_PICKER_COPY.levels,
    /**
     * Shown on a level whose parent is unpicked. The picker's builder, whose index
     * 0 reads `Pick a category.` and belongs to the screen that picks one — this
     * screen never reaches it, because level 1 always has options.
     */
    awaitingParent: CATEGORY_PICKER_COPY.awaitingParent,

    /** The level-3 control's two choices beside the parent's own children. */
    level3New: "Add one the catalog does not have",
    noDivision: "No division at this level",
    /**
     * ONE SENTENCE FOR THE MARK AND FOR THE PATH IT PRODUCES, because it is one
     * fact: the mark stores a placeholder and the label leaves it out. Saying it
     * twice in two wordings would make it two facts the first time either moved.
     * The stored word is not named, deliberately — what the person is choosing is
     * the meaning.
     */
    noDivisionNote: "A level with no division below it is left out of the path.",
    level3NameLabel: "Name the new level 3",

    nameLabel: "Item Name",
    nameHint: "What every purchase order, invoice and delivery will call this material.",
    /** The draft, named as one so nobody reads the filled box as a computed value. */
    nameDrafted: "Drafted from the levels above. Type over it.",

    /**
     * The two lines before the save, and they are two because they are two
     * different strings — the name a document prints and the place the row sits.
     * `/materials` aside, no screen in this app carries a path; this one does,
     * because it is the only place a row is planted in the tree and there is no
     * other way to see where.
     *
     * NEITHER CARRIES THE COMPUTED CODE, and that is a decision rather than an
     * omission: the code is settled by the server inside a lock, so a preview
     * promising `…901` would be contradicted by a row landing on `…902` the moment
     * two people add a path under one branch. The account of what was written
     * names it instead, where it is a fact rather than a forecast.
     */
    previewName: (itemName) => `Documents will call it ${itemName}.`,
    previewPath: (label) => `It sits at ${label}.`,

    /**
     * The level-4 names already under the chosen level 3, shown while somebody
     * types — `/addresses/new`'s panel, for the same reason: the person is one
     * keystroke from a path that already exists. The empty case is a sentence
     * rather than a silence, because an absent list cannot be told apart from one
     * that looked and found nothing.
     */
    onLevel3: (name) => `Already under ${name}:`,
    noneOnLevel3: (name) => `${name} has nothing under it yet.`,

    submit: "Create Category",

    /** The page's own refusal, for a reader who is not the office. */
    notAdmin: "Not authorized. This page is Admin-only.",
    /** The action's, which lands in the slot the form's other refusals use. */
    notAuthorized: "Not authorized.",

    fieldsMissing:
        "A category needs a level 1 and a level 2 from the catalog, a level 3, a level 4 and an item name.",
    parentUnknown: "That level 2 is not in the catalog. Pick one from the list.",

    /**
     * ONE SENTENCE FOR THE PREVIEW AND THE REFUSAL, `labelTaken`'s shape: the form
     * says it while somebody types and the action says it after they submit.
     *
     * IT NAMES THE CATEGORY THAT HOLDS THE NAME, AND NOTHING HERE IS SCOPED. This
     * table carries no owner, no job and no user link, so no rule in this app
     * computes a scope over it; `getCategoryTree` hands all 777 rows — labels, item
     * names and every level — to any active user on `/prs/new`, and this reader is
     * an Admin. So the sentence tells its reader nothing they cannot already read
     * from the request form, which is what lets it name the useful thing instead of
     * a not-found.
     */
    nameTaken: ({ itemName, label }) =>
        `${itemName} is already the item name of ${label}. Use that category, or give ` +
        `this one a name that tells the two apart.`,

    pathExists: (label) =>
        `${label} is already in the catalog. Pick a different level 4, or use that category.`,

    codesExhausted: (parentCode) =>
        `${parentCode} has no code left between ${BRANCH_CODE_FLOOR} and ${BRANCH_CODE_CEILING}, ` +
        `which is the range this office adds paths in.`,

    /**
     * The code the write path computed turned out to be taken. Rare, and the
     * sentence does not promise a resubmit works: the ordinary cause is another
     * submission landing between the read and the write, where it does, and the
     * other is a row filed under a different branch carrying this code, where it
     * does not. See `nextBranchCode` for why those are different populations.
     */
    codeTaken: (code) =>
        `${code} is already a category code, so nothing was created. Submit again — the ` +
        `same code coming back means the row carrying it sits under another branch.`,

    /**
     * THE ACCOUNT OF WHAT WAS WRITTEN NAMES THE LEAF CODE, which is the one entry
     * here with a reason outside wording: the code is what has to be unique, it is
     * what somebody looks the row up by in Airtable, and it is the only part of the
     * row this screen decided rather than the person.
     */
    created: ({ itemName, code, label }) =>
        `Created ${itemName} at ${code}. It sits at ${label}.`,
};
