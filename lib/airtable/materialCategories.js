import { base, findByRecordIds, TABLES, withKeyLock } from "./client";
import { CATEGORY_ITEM_NAME, CATEGORY_LEAF_CODE, CATEGORY_LEVELS, toCategory } from "../materialCategory";
import { categoryNameKey, categoryRecordFields } from "../categoryCreation";
import { andSearchAll, formulaString, orByField } from "../airtableFormula";

/**
 * `Material Categories` is HQ's four-level tree as reference data (#354): 777
 * rows, one per path, each carrying the code and the English name at every
 * level. The rows arrive from
 * `scripts/import/create_material_categories_354.mjs`, and a path the tree does
 * not have is added to the table directly, which `docs/notes/materials.md`
 * records as the reason `Category Label` is a formula.
 *
 * THIS MODULE HAD NO WRITE UNTIL #368 AND THE OLD SENTENCE SAID SO. "Nothing in
 * this app writes to it" was true from #354 to #367 — a path was added by hand in
 * Airtable, with four codes, four names and an item name in a person's typing.
 * `createCategoryUnderLevel2` is the one write, it is the only one, and it is
 * still true that nothing here writes `Category Label`.
 *
 * THIS MODULE DID NOT SHIP WITH THE TABLE, DELIBERATELY. #354 created the table
 * and left the reader out, because a service-layer function with no caller is
 * verified by nothing — CLAUDE.md's own example is `upsertMaterial`, which sat
 * unused from Phase 0 to #18 carrying three defects. It arrives here with its
 * first caller, the request form.
 */

/**
 * One record in the shape every function here hands back.
 *
 * EXTRACTED IN #368, WHICH WAS ABOUT TO WRITE A FOURTH COPY. The three readers
 * each spelled this mapping out — `Category Label`, `Item Name` and the eight
 * level columns through `toCategory` — and the write path needs the same shape for
 * the row it creates. Four copies of one projection is the duplication CLAUDE.md's
 * own section is about, and the field list is the half that would drift: a column
 * added to one reader and not the others is invisible until a caller reads
 * `undefined`.
 */
function recordToCategory(record) {
    return toCategory({
        id: record.id,
        label: record.get("Category Label"),
        itemName: record.get(CATEGORY_ITEM_NAME),
        ...Object.fromEntries(
            CATEGORY_LEVELS.flatMap((l) => [
                [l.code, record.get(l.code)],
                [l.name, record.get(l.name)],
            ])
        ),
    });
}

/** The projection every read here passes — see `recordToCategory`. */
const CATEGORY_FIELDS = [
    "Category Label",
    CATEGORY_ITEM_NAME,
    ...CATEGORY_LEVELS.flatMap((l) => [l.code, l.name]),
];

/**
 * The whole tree, for a form that narrows through it.
 *
 * ONE READ RATHER THAN ONE PER LEVEL, AND THAT IS MEASURED RATHER THAN
 * PREFERRED. Airtable pages at 100 records, so `.all()` over 777 rows is 8 list
 * operations. A query per level cannot beat that, because the first level needs
 * the 39 distinct level-1 values and **Airtable has no DISTINCT** — that step
 * alone scans the same 777 rows for the same 8 operations, and then adds a round
 * trip to the user for every level after it. So the per-level shape is strictly
 * worse on both axes rather than a trade.
 *
 * WHAT THE 8 IS BOUNDED BY is the catalog, not the company's history: it grows
 * when HQ adds a path and never with the number of requests, orders or
 * documents. That is the same reading `getDeliveryCandidates` gets — one query
 * per page, independent of how much work the base has seen — and the opposite of
 * the shape #244 removed from `/invoices/new`, where the cost carried a term in
 * the order count and therefore had no ceiling. `docs/notes/airtable-access.md`
 * states the criterion: the number that matters is the shape.
 *
 * The projection is the five values the form actually needs. It does not reduce
 * the operation count — page count follows row count — but it is most of the
 * response body, and the tree is handed to a Client Component.
 */
export async function getCategoryTree() {
    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            fields: CATEGORY_FIELDS,
            // Alphabetical by the composed path, so every level's options come
            // out in a stable order without the caller sorting four times. The
            // primary is the label, so this is one sort the base can do.
            sort: [{ field: "Category Label", direction: "asc" }],
        })
        .all();

    return records.map(recordToCategory);
}

/**
 * Whether any category in the tree matches every one of these tokens (#357).
 *
 * WHAT IT IS FOR IS ONE SENTENCE ON A SCREEN, and the shape follows from that.
 * `/materials` searches `Materials."Material Label"`, which carries the composed
 * path since #356, so a query that matches nothing splits two ways: the catalog
 * has no category carrying those words, or it has one and no purchase order has
 * put an item under it. Those are different facts and a reader cannot tell them
 * apart from an empty list, so the screen asks.
 *
 * ONE OPERATION, AND ONLY ON A MISS. `maxRecords: 1` because the answer is a
 * yes or a no — the caller never sees a row, and loading the tree to count would
 * be `getCategoryTree`'s 8 operations against a screen whose whole budget is 7.
 * The call site is the empty branch of the search, so a query that found
 * something costs nothing at all.
 *
 * The SAME token rule as the materials query, deliberately: `andSearchAll` over
 * the composed label on both sides, so "the catalog has one" cannot disagree
 * with "the search would have found it". Two spellings of one predicate is the
 * duplication CLAUDE.md's own section is about, and the builder is what makes it
 * one.
 *
 * No tokens is not a question. A browse has matched everything by definition,
 * and `andSearchAll`'s empty case is `FALSE()` — the right contract for a
 * predicate and the wrong answer to ask here — so it is short-circuited before
 * it reaches the base, as `getCategoriesByLeafCode` short-circuits an empty list.
 */
export async function anyCategoryMatches(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return false;

    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            filterByFormula: andSearchAll("Category Label", tokens),
            fields: [CATEGORY_LEAF_CODE],
            maxRecords: 1,
        })
        .firstPage();

    return records.length > 0;
}

/**
 * The categories a set of leaf codes names, keyed by leaf code.
 *
 * THE WRITE PATH NEEDS RECORD IDS AND THE FORM CARRIES CODES, which is the one
 * place those two representations meet. A leaf code is unique across the whole
 * tree (777 of 777, asserted in `offline/material-categories.mjs`), so this is a
 * lookup rather than a search — but it is a `filterByFormula` on a text field
 * rather than a record-id match, because the browser has no business holding a
 * record id it did not fetch this render.
 *
 * One query for every code an item list carries, through `orByField`, rather
 * than one per item: a 20-item request costs 1 operation here, not 20. An empty
 * list yields `FALSE()` inside the builder and is short-circuited before it
 * reaches the base at all.
 */
export async function getCategoriesByLeafCode(leafCodes) {
    const wanted = Array.from(new Set((leafCodes || []).filter(Boolean)));
    if (wanted.length === 0) return new Map();

    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            filterByFormula: orByField(CATEGORY_LEAF_CODE, wanted),
            fields: CATEGORY_FIELDS,
        })
        .all();

    // A DUPLICATE LEAF CODE THROWS RATHER THAN LETTING THE LAST ROW WIN, and
    // that is the whole reason this loop is not a one-liner. Nothing keeps leaf
    // codes unique: Airtable cannot make a text field unique — the same limit
    // `tools.md` records for `Tools."Tool Name"` — and this app never writes a
    // category row, so there is no write to serialize and none of
    // `upsertMaterial`'s normalize-lock-compare shape can attach.
    //
    // #368 MADE THIS RARE AND DID NOT MAKE IT UNNECESSARY, which is worth
    // saying here so the next reader does not delete it as superseded. Before
    // that issue a path was added by hand in Airtable, so a mistyped code was an
    // ordinary slip; `createCategoryUnderLevel2` picks the parent and computes
    // the next number, so nobody types one on the usual path. Hand editing the
    // table stays possible either way — the rows are reference data anyone with
    // the base open can touch — so this is no longer the common case and is the
    // last net under it.
    //
    // WHAT LAST-WRITE-WINS WOULD COST is not an error but a wrong document. The
    // picker deduped by code and kept the row whose label sorts first; this
    // query has no sort at all, so the winner here is Airtable's return order
    // and the two tie-breaks need not agree. The requester would pick one path,
    // the link would point at the other, and `Item Name` — frozen from that
    // row's label — is what the vendor reads on the purchase order. So this
    // refuses, naming both records, in `findChildRecords`' posture: a loud
    // failure beats a silent wrong answer.
    const byCode = new Map();
    for (const record of records) {
        const code = record.get(CATEGORY_LEAF_CODE);
        const already = byCode.get(code);
        if (already) {
            throw new Error(
                `${TABLES.MATERIAL_CATEGORIES}: ${CATEGORY_LEAF_CODE} ${code} is on more than one ` +
                `row (${already.recordId}, ${record.id}). A leaf code names one category; ` +
                `delete or renumber one of them in Airtable.`
            );
        }
        byCode.set(code, recordToCategory(record));
    }
    return byCode;
}

/**
 * The categories a set of record ids names, keyed by record id — the direction
 * `getCategoriesByLeafCode` runs in reverse.
 *
 * THIS IS THE READER THE COMMENT BELOW SAID WOULD NEVER BE NEEDED, AND THE
 * COMMENT WAS RIGHT ABOUT SCREENS AND SILENT ABOUT THE WRITE PATH. A `PR Items`
 * row carries a `Category` link and every SCREEN showing one has already fetched
 * the whole tree for its pickers, so a screen resolves a row's category in
 * memory for 0 operations. `lib/materialsCache.js` holds no tree and cannot: it
 * runs at PO generation, one request after the form, and #356 keys
 * `upsertMaterial` on the category's LEAF CODE while what a PR item stores is a
 * record id. So this is the one place the two representations have to be
 * resolved in that direction, and it arrives with that caller rather than ahead
 * of it.
 *
 * ONE QUERY PER 50 IDS AND NONE PER ITEM, through `findByRecordIds` — a 20-item
 * order costs 1 operation here. Ids that do not resolve are simply absent from
 * the map, which is what lets the caller SKIP the ordered item and report it
 * rather than fail a whole approval; `findChildRecords`' refuse-a-short-result
 * posture is for a parent's own link array, where a missing child is a broken
 * document, and a category deleted from the catalog is not that.
 */
export async function getCategoriesByRecordIds(recordIds) {
    const wanted = Array.from(new Set((recordIds || []).filter(Boolean)));
    if (wanted.length === 0) return new Map();

    const records = await findByRecordIds(TABLES.MATERIAL_CATEGORIES, wanted, {
        fields: CATEGORY_FIELDS,
    });

    return new Map(records.map((record) => [record.id, recordToCategory(record)]));
}

// THERE IS DELIBERATELY NO SINGLE-RECORD `getCategoryByRecordId`, and the
// batched reader above is not one. A screen resolves a row's category from the
// tree it already holds, for 0 operations; a caller wanting one category reads
// it as a set of one, which costs the same query and cannot become the per-row
// read `findChildRecords` exists to prevent.

// ---------------------------------------------------------------------------
// The one write (#368)
// ---------------------------------------------------------------------------

/**
 * ONE LOCK FOR THE WHOLE TABLE, WHERE THE MATERIAL LOCKS ARE PER KEY.
 *
 * `upsertMaterial` locks on a material's own key because two different materials
 * must not serialize against each other. Both invariants this write defends are
 * TABLE-WIDE — a leaf code names one category, and an item name names one
 * category (#415, and #416 is what stands on it) — so there is no second key to
 * split on, and two people adding a path under two different branches serializing
 * costs nothing: this is one office's screen and a path arrives when the site asks
 * for one.
 *
 * ONE LOCK ALSO MEANS NO NESTING, which CLAUDE.md forbids outright. Nothing on
 * this path takes a second: `Material Categories` mints no `X ID`, so
 * `generateChildId` and `mintDailyIds` are not reached at all.
 */
const CATEGORY_LOCK_KEY = "materialCategory::catalog";

/** Every row under one level-2 code, in the shape the planner reads. */
async function getCategoriesUnderLevel2(level2Code) {
    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            filterByFormula: orByField("Level 2 Code", [level2Code]),
            fields: CATEGORY_FIELDS,
        })
        .all();

    return records.map((record) => recordToCategory(record));
}

/**
 * The category carrying this item name, or null — #368's duplicate gate.
 *
 * `getAddressByLabel`'S AND `getToolByName`'S COMPARISON RATHER THAN A SECOND ONE:
 * `LOWER(TRIM(…))` on both sides, over a value `normalizeItemText` has already
 * collapsed the internal whitespace of. Measured in #338 and relied on here:
 * Airtable's `=` on a text field is case-SENSITIVE, so a bare `=` would admit
 * `tube, sus 304, ap` beside a stored `Tube, SUS 304, AP` — two categories
 * answering to one name, which is the invariant #416 put every document's material
 * name on.
 *
 * THE FOLD IS ON A STORED TEXT FIELD AND NOT ON A LOOKUP, which is what keeps it
 * out of #416's trap: `LOWER()` over a lookup returns blank and matches nothing,
 * silently. `Material Categories."Item Name"` is `singleLineText` — read off the
 * live schema — so the fold applies to a string.
 */
async function getCategoryByItemName(itemName) {
    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            // The field name is spelled rather than interpolated: a field
            // reference is `{...}` and escaping it would break it, so
            // `offline/formula-escaping.mjs` reads any interpolation here as an
            // unescaped VALUE — correctly, since the AST cannot tell the two
            // apart. `getAddressByLabel` spells its own for the same reason.
            filterByFormula: `LOWER(TRIM({Item Name})) = LOWER(TRIM("${formulaString(
                categoryNameKey(itemName)
            )}"))`,
            fields: CATEGORY_FIELDS,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToCategory(records[0]);
}

/** Whether any row already carries one of these codes at its own level. */
async function codeAlreadyUsed(fieldName, code) {
    const records = await base(TABLES.MATERIAL_CATEGORIES)
        .select({
            filterByFormula: orByField(fieldName, [code]),
            fields: [CATEGORY_LEAF_CODE],
            maxRecords: 1,
        })
        .firstPage();

    return records.length > 0;
}

/**
 * Add a path under one level 2 (#368) — the read, the plan and the write under one
 * lock.
 *
 * `planFrom` IS CALLED INSIDE THE LOCK AND THAT IS THE WHOLE REASON IT IS A
 * CALLBACK, which is `generateChildId`'s and `mintDailyIds`' shape. The plan
 * COMPUTES a code from the rows this function read, so reading outside the lock
 * would mean planning against a tree another submission had already moved — and
 * the repair would be a refusal where the right answer is the next number.
 *
 * THE COMPUTED CODES ARE RE-ASKED OF THE BASE BEFORE THE CREATE, and this is not
 * the same question the plan already answered. The plan numbers the code among the
 * chosen parent's CHILDREN; what has to be true is that no row anywhere carries
 * it, and those are different populations because 11 of the 777 rows break prefix
 * nesting. It also narrows the window `withKeyLock` cannot close — it serializes
 * within one process or invocation only, so two concurrent Vercel invocations
 * remain the residual every family on this base lives with, and the form's
 * disable-on-submit is the other half.
 *
 * THE LEVEL-3 CODE IS RE-ASKED ONLY WHEN IT IS MINTED. A reused one is a code the
 * read found, so asking whether it exists is asking whether the row we just read
 * is there.
 *
 * Returns `{ category }`, or one of three facts for the caller to word: the plan's
 * own refusal, the category holding the name, or the code that was taken. **No
 * sentence is built here** — `createAddressIfLabelFree` draws the same line, and it
 * is what keeps screen copy out of a credentialed module.
 *
 * FOUR OR FIVE OPERATIONS: the rows under the parent, the name, the leaf code, the
 * level-3 code when minted, and the create.
 */
export async function createCategoryUnderLevel2(level2Code, planFrom) {
    return withKeyLock(CATEGORY_LOCK_KEY, async () => {
        const rows = await getCategoriesUnderLevel2(level2Code);
        const { plan, refusal } = planFrom(rows);
        if (refusal) return { category: null, refusal, existingName: null, takenCode: null };

        const existingName = await getCategoryByItemName(plan.itemName);
        if (existingName) return { category: null, refusal: null, existingName, takenCode: null };

        const [, , level3Code, leafCode] = plan.codes;
        if (plan.level3IsNew && (await codeAlreadyUsed("Level 3 Code", level3Code))) {
            return { category: null, refusal: null, existingName: null, takenCode: level3Code };
        }
        if (await codeAlreadyUsed(CATEGORY_LEAF_CODE, leafCode)) {
            return { category: null, refusal: null, existingName: null, takenCode: leafCode };
        }

        const record = await base(TABLES.MATERIAL_CATEGORIES).create(categoryRecordFields(plan));
        return {
            category: recordToCategory(record),
            refusal: null,
            existingName: null,
            takenCode: null,
        };
    });
}

