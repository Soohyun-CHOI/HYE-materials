// Adding a path to the catalog, against the live base — credentialed tier (#368).
//
// WHAT ONLY THIS CAN SEE, and it is more than usual. `offline/category-creation.mjs`
// holds the arithmetic, the resolution and the copy, all in JavaScript over a
// fixture tree. Three of this feature's claims are not in JavaScript at all:
//
//   1. THE LABEL. `Material Categories."Category Label"` is an Airtable formula, so
//      what a row this app created is CALLED is computed by the base. The screen
//      previews `composeCategoryLabel`'s answer; only a live row says whether the
//      two agree on a path nobody imported.
//   2. THE DUPLICATE GATE. `LOWER(TRIM({Item Name}))` is evaluated by Airtable, and
//      #416 measured that the same expression over a LOOKUP returns blank and
//      matches nothing, silently. This field is stored text, which is exactly the
//      distinction that makes the fold work — and a distinction is worth measuring.
//   3. THE CODE, TWICE. That the computed leaf code lands on the row as text with
//      its leading zeros, and that a second path under one parent takes the next
//      number rather than the same one.
//
// AND PART E ASKS WHICH SIDE OF THE DUPLICATE GATE BLOCKS WHAT, because a refusal
// is consistent with either side having done the work. #338's measurement was on
// another field and not on this combination, so the bare `=` is run as the control
// and the internal-run case is shown to be blocked by the JS key alone.
//
// WHAT IT DELIBERATELY DOES NOT COVER IS THE ACTION WRAPPER AND THE FORM. It calls
// the production service function and the production planner, which is everything
// between the submitted fields and the row; the Admin gate and the controls are
// browser facts, measured with the two fixture accounts and recorded in the pull
// request. #382's `Next-Action` RPC exists for an action with no form behind it,
// and this one has a form.
//
// IT CREATES ROWS IN THE CATALOG AND DELETES THEM IN THE SAME RUN, which is the
// fixture contract `scripts/tests/_fixtures.mjs` owns and nothing wider: the rows
// are this run's own, under the credentialed tier's own branch, and the run's tag
// is unique to it. **The branch is 17, which `scripts/tests/_categories.mjs`
// records as used by no demo seed** — a path added under a seed's branch would
// widen that seed's picker for as long as it existed.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-category-creation-368.mjs
//
// About 60 operations. Exit codes, per docs/notes/verification.md: 0 all clear,
// 1 something failed OR fixtures leaked, 2 clean but a part could not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { createCategoryUnderLevel2 } from "../../lib/airtable/materialCategories.js";
import { formulaString } from "../../lib/airtableFormula.js";
import {
    BRANCH_CODE_FLOOR,
    CATEGORY_CREATION_COPY as COPY,
    LEVEL_CHOICE,
    NO_DIVISION_NAME,
    categoryNameKey,
    planCategory,
} from "../../lib/categoryCreation.js";
import {
    CATEGORY_ITEM_NAME,
    CATEGORY_LEAF_CODE,
    CATEGORY_LEVELS,
    composeCategoryLabel,
} from "../../lib/materialCategory.js";
import { createFixtures } from "./_fixtures.mjs";

const TABLE = TABLES.MATERIAL_CATEGORIES;
const LABEL_FIELD = "Category Label";

/**
 * The parent every path here hangs off: `17 Plumbing Piping Materials (Supply &
 * Drain)` → `1704 Pipe Support Materials`, and `1704002 Strut Framing System` as
 * the existing level 3 the reuse case joins.
 *
 * HARD-CODED FOR `scripts/tests/_categories.mjs`' OWN REASON: a code is unique
 * across the tree and stable, and the assertions below fail loudly on one the
 * catalog does not have rather than quietly fixturing something else.
 */
const LEVEL1_CODE = "17";
const LEVEL2_CODE = "1704";
const EXISTING_LEVEL3_CODE = "1704002";

/** The committed tree's size, as a floor — a hand-added path is a normal event. */
const COMMITTED_ROWS = 777;

let pass = true;
let incomplete = false;
/** The label the base computed for Part B's row, which Part D expects back. */
let reuseLabel = "";
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};
const show = (label, value) => console.log(`        ${label}: ${JSON.stringify(value)}`);

const fixtures = createFixtures({
    tag: "V368",
    buckets: [
        {
            name: "categories",
            table: TABLE,
            label: "Material Category",
            // The one field this run gets to choose freely. The level names carry
            // the tag too, but a bucket stamps one field and this is the one the
            // duplicate gate reads.
            tagField: CATEGORY_ITEM_NAME,
        },
    ],
});

const TAG = fixtures.TAG;
const FIELDS = [LABEL_FIELD, CATEGORY_ITEM_NAME, ...CATEGORY_LEVELS.flatMap((l) => [l.code, l.name])];

console.log(`Adding a path to the catalog, live (#368) — run ${TAG}\n`);

/** One submission, as the form would post it. */
function submission(over) {
    return {
        level1Code: LEVEL1_CODE,
        level2Code: LEVEL2_CODE,
        level3Choice: EXISTING_LEVEL3_CODE,
        level3Name: "",
        level4NoDivision: false,
        level4Name: "",
        itemName: "",
        ...over,
    };
}

/** The production path, exactly as `createCategoryAction` calls it. */
async function create(fields) {
    return createCategoryUnderLevel2(fields.level2Code, (rows) => planCategory(fields, rows));
}

/** One row read back on its own, rather than off the create response. */
async function readBack(recordId) {
    const record = await base(TABLE).find(recordId);
    return Object.fromEntries(FIELDS.map((f) => [f, record.get(f)]));
}

try {
    // -----------------------------------------------------------------------
    // Part A — the catalog before anything is written.
    // -----------------------------------------------------------------------
    console.log("Part A — the premise, on the live table:");
    const before = await base(TABLE).select({ fields: FIELDS }).all();
    ok(`the committed rows are all there (${before.length})`, before.length >= COMMITTED_ROWS);

    const names = before.map((r) => String(r.get(CATEGORY_ITEM_NAME) ?? ""));
    ok("every row names something", names.every((n) => n.trim() !== ""));
    ok("no two rows name the same thing", new Set(names).size === before.length);
    ok(
        "nor under the fold the duplicate gate compares with",
        new Set(names.map((n) => n.trim().toLowerCase())).size === before.length
    );

    const tails = before.map((r) => Number(String(r.get(CATEGORY_LEAF_CODE)).slice(-3)));
    ok(
        `the 900 block is free, which is what the convention rests on (highest tail ${Math.max(...tails)})`,
        tails.filter((t) => t >= BRANCH_CODE_FLOOR).length === 0
    );

    const parent = before.filter((r) => r.get("Level 2 Code") === LEVEL2_CODE);
    ok(`the fixture parent is on the base (${parent.length} rows under ${LEVEL2_CODE})`, parent.length > 0);
    ok(
        `and its level 1 is ${LEVEL1_CODE}`,
        parent.every((r) => r.get("Level 1 Code") === LEVEL1_CODE)
    );
    const existingLevel3 = parent.filter((r) => r.get("Level 3 Code") === EXISTING_LEVEL3_CODE);
    ok(`the existing level 3 is there (${EXISTING_LEVEL3_CODE})`, existingLevel3.length > 0);
    const existingLevel3Name = String(existingLevel3[0]?.get("Level 3 Category") ?? "");
    show("its name", existingLevel3Name);

    // -----------------------------------------------------------------------
    // Part B — a leaf under an existing level 3.
    // -----------------------------------------------------------------------
    console.log("");
    console.log("Part B — a leaf under an existing level 3:");
    const reuseFields = submission({
        level4Name: `${TAG} Bracket`,
        itemName: `${TAG} Strut Bracket`,
    });
    const reuse = await create(reuseFields);
    ok("it was created", Boolean(reuse.category), reuse.refusal ?? "");
    if (reuse.category) {
        fixtures.track("categories", reuse.category.recordId);
        const row = await readBack(reuse.category.recordId);
        show("the row, read back on its own", row);

        ok(
            `the leaf code is the parent's plus the floor (${EXISTING_LEVEL3_CODE}${BRANCH_CODE_FLOOR})`,
            row[CATEGORY_LEAF_CODE] === `${EXISTING_LEVEL3_CODE}${BRANCH_CODE_FLOOR}`
        );
        ok("the level 3 is the one that was picked", row["Level 3 Code"] === EXISTING_LEVEL3_CODE);
        ok("and it kept the sibling's own spelling", row["Level 3 Category"] === existingLevel3Name);
        ok("the leaf code is ten digits of text", /^\d{10}$/.test(String(row[CATEGORY_LEAF_CODE])));
        ok("the item name is stored as submitted", row[CATEGORY_ITEM_NAME] === reuseFields.itemName);

        // FOUR CLAIMS ABOUT THE LABEL, AND THEY ARE FOUR BECAUSE THEY ARE NOT ONE.
        // The create response carrying a string, the base holding that string, the
        // two being the same string, and the string being what the rule composes
        // are separate facts — and the screen's success line promises the FIRST one
        // to a person, so a response that agreed with nothing would be a sentence
        // about a path that is not there.
        const fromResponse = reuse.category.label;
        show("the label on the create response", fromResponse);
        ok("1. the create response carries a label at all", String(fromResponse ?? "") !== "");

        show("the label the base holds, read on its own", row[LABEL_FIELD]);
        ok("2. the base holds a label for that row", String(row[LABEL_FIELD] ?? "") !== "");

        ok(
            "3. and the two are the same string — the success line promises this one",
            fromResponse === row[LABEL_FIELD]
        );

        // The two sides here were produced by DIFFERENT implementations on the same
        // four values, which is the only reason this comparison says anything.
        const expected = composeCategoryLabel(
            Object.fromEntries(CATEGORY_LEVELS.map((l) => [l.name, row[l.name]]))
        );
        show("what the JS rule composes", expected);
        ok("4. the base's value is what the JS rule composes", row[LABEL_FIELD] === expected);
        reuseLabel = String(row[LABEL_FIELD] ?? "");

        const links = await base(TABLE).find(reuse.category.recordId);
        ok("Materials is empty on the new row", (links.get("Materials") ?? []).length === 0);
        ok("and so is PR Items", (links.get("PR Items") ?? []).length === 0);
    }

    // -----------------------------------------------------------------------
    // Part C — a leaf under a level 3 this submission adds, and the next number.
    // -----------------------------------------------------------------------
    console.log("");
    console.log("Part C — a level 3 the catalog does not have, and the number after it:");
    const mintFields = submission({
        level3Choice: LEVEL_CHOICE.newLevel,
        level3Name: `${TAG} Frame`,
        level4Name: `${TAG} Clip`,
        itemName: `${TAG} Frame Clip`,
    });
    const minted = await create(mintFields);
    ok("it was created", Boolean(minted.category), minted.refusal ?? "");
    let mintedLevel3 = null;
    if (minted.category) {
        fixtures.track("categories", minted.category.recordId);
        const row = await readBack(minted.category.recordId);
        mintedLevel3 = String(row["Level 3 Code"]);
        show("the row, read back on its own", row);
        ok(
            `the level 3 took the floor under ${LEVEL2_CODE} (${LEVEL2_CODE}${BRANCH_CODE_FLOOR})`,
            mintedLevel3 === `${LEVEL2_CODE}${BRANCH_CODE_FLOOR}`
        );
        ok(
            `and its first leaf took the floor under that (${mintedLevel3}${BRANCH_CODE_FLOOR})`,
            row[CATEGORY_LEAF_CODE] === `${mintedLevel3}${BRANCH_CODE_FLOOR}`
        );
        ok("the typed level-3 name is stored", row["Level 3 Category"] === mintFields.level3Name);
        const expected = composeCategoryLabel(
            Object.fromEntries(CATEGORY_LEVELS.map((l) => [l.name, row[l.name]]))
        );
        ok("the base and the rule agree on its label", row[LABEL_FIELD] === expected);
        show("the label the base computed", row[LABEL_FIELD]);
    }

    // The same level-3 NAME again: it must resolve to the code just minted rather
    // than mint a second one, and its leaf must take the next number.
    const secondFields = submission({
        level3Choice: LEVEL_CHOICE.newLevel,
        level3Name: `${TAG} frame`, // deliberately a different case
        level4NoDivision: true,
        level4Name: "",
        itemName: `${TAG} Frame, plain`,
    });
    const second = await create(secondFields);
    ok("a second leaf under the same new level 3 was created", Boolean(second.category), second.refusal ?? "");
    if (second.category) {
        fixtures.track("categories", second.category.recordId);
        const row = await readBack(second.category.recordId);
        show("the row, read back on its own", row);
        ok(
            "the level 3 was reused, case-insensitively, rather than minted again",
            row["Level 3 Code"] === mintedLevel3
        );
        ok("  keeping the first spelling", row["Level 3 Category"] === mintFields.level3Name);
        ok(
            `the leaf took the next number (${mintedLevel3}${BRANCH_CODE_FLOOR + 1})`,
            row[CATEGORY_LEAF_CODE] === `${mintedLevel3}${BRANCH_CODE_FLOOR + 1}`
        );
        ok("a marked level 4 stores the placeholder", row["Level 4 Category"] === NO_DIVISION_NAME);
        // AND THE LABEL DROPS IT, which is the consequence the screen's second
        // preview line exists to show.
        ok(
            "and the label leaves that level out",
            !String(row[LABEL_FIELD] ?? "").endsWith(NO_DIVISION_NAME)
        );
        show("the label the base computed", row[LABEL_FIELD]);
    }

    // -----------------------------------------------------------------------
    // Part D — the refusals, attempted for real.
    // -----------------------------------------------------------------------
    console.log("");
    console.log("Part D — what is refused, and that nothing is written when it is:");
    const countBefore = (await base(TABLE).select({ fields: [CATEGORY_LEAF_CODE] }).all()).length;

    const dupe = await create(
        submission({ level4Name: `${TAG} Bracket II`, itemName: `${TAG} Strut Bracket` })
    );
    ok("a name another category holds is refused", dupe.category === null && Boolean(dupe.existingName));
    ok(
        "  and the refusal names that category",
        Boolean(dupe.existingName) &&
            COPY.nameTaken({
                itemName: dupe.existingName.itemName,
                label: dupe.existingName.label,
            }).includes(dupe.existingName.label)
    );

    const dupeCase = await create(
        submission({ level4Name: `${TAG} Bracket III`, itemName: `${TAG} STRUT bracket` })
    );
    ok(
        "the same name in another case is refused too — the fold works on the base",
        dupeCase.category === null && Boolean(dupeCase.existingName)
    );

    const dupeSpaces = await create(
        submission({ level4Name: `${TAG} Bracket IV`, itemName: `  ${TAG} Strut   Bracket  ` })
    );
    ok(
        "and so is one differing only by whitespace",
        dupeSpaces.category === null && Boolean(dupeSpaces.existingName)
    );

    // The same four names as Part B's row, in another case: one path, so the label
    // would collide and the 777 labels are distinct.
    const pathTwice = await create(
        submission({ level4Name: `${TAG} bracket`, itemName: `${TAG} Something Else` })
    );
    ok(
        "a path that already exists is refused",
        pathTwice.category === null && pathTwice.refusal === COPY.pathExists(reuseLabel),
        pathTwice.refusal ?? ""
    );

    // COMPLETE IN EVERY OTHER FIELD, which the first version of these two was not:
    // the plan refuses a missing field BEFORE it looks for the parent, so a
    // submission short of a level-4 name never reaches the parent question. That
    // ordering is deliberate — nothing about a parent can be judged without the
    // fields — and it is what made the first run report `fieldsMissing` here.
    const badParent = await create(
        submission({ level2Code: "999999", level4Name: `${TAG} Nowhere`, itemName: `${TAG} Nowhere` })
    );
    ok(
        "a level 2 the catalog does not have is refused",
        badParent.category === null && badParent.refusal === COPY.parentUnknown,
        badParent.refusal ?? ""
    );

    const badLevel1 = await create(
        submission({ level1Code: "01", level4Name: `${TAG} Wrong Branch`, itemName: `${TAG} Wrong Branch` })
    );
    ok(
        "a level 1 that is not this level 2's parent is refused",
        badLevel1.category === null && badLevel1.refusal === COPY.parentUnknown,
        badLevel1.refusal ?? ""
    );

    const countAfter = (await base(TABLE).select({ fields: [CATEGORY_LEAF_CODE] }).all()).length;
    ok(`six refusals wrote nothing (${countBefore} rows before, ${countAfter} after)`, countBefore === countAfter);

    // -----------------------------------------------------------------------
    // Part E — WHICH SIDE OF THE DUPLICATE GATE ACTUALLY BLOCKS WHAT.
    //
    // #338 measured that Airtable's `=` on a text field is case-SENSITIVE and that
    // `LOWER(TRIM(…))` admits the folded form, and that `LOWER(TRIM(…))` cannot
    // collapse an INTERNAL run. It measured that on `Vendors."Vendor Name"`, not on
    // this field and not on this combination — and Part D's two refusals are
    // consistent with the base doing the work AND with the JS normalization doing
    // it, which is exactly the kind of agreement that reads as proof and is not.
    // So each half is asked separately, with the bare `=` as the control.
    // -----------------------------------------------------------------------
    console.log("");
    console.log("Part E — the two halves of the duplicate gate, each on its own:");
    const stored = `${TAG} Strut Bracket`;
    const upper = stored.toUpperCase();
    const spaced = `${TAG} Strut   Bracket`;
    const count = async (formula) =>
        (await base(TABLE).select({ filterByFormula: formula, fields: [CATEGORY_ITEM_NAME] }).all()).length;
    const exact = (value) => `{Item Name} = "${formulaString(value)}"`;
    const folded = (value) => `LOWER(TRIM({Item Name})) = LOWER(TRIM("${formulaString(value)}"))`;

    ok(`the control: a bare = finds the row as stored (${await count(exact(stored))})`, (await count(exact(stored))) === 1);
    ok(
        `a bare = does NOT find it upper-cased (${await count(exact(upper))}) — so the fold is load-bearing`,
        (await count(exact(upper))) === 0
    );
    ok(`LOWER(TRIM()) does find it upper-cased (${await count(folded(upper))})`, (await count(folded(upper))) === 1);
    ok(
        `a bare = does NOT find it double-spaced (${await count(exact(spaced))})`,
        (await count(exact(spaced))) === 0
    );
    // THE HALF THE BASE CANNOT DO, which is why `normalizeItemText` on the write
    // side is load-bearing rather than tidy: TRIM takes the ends and leaves an
    // internal run alone, so the whitespace case is blocked by the JS key the query
    // is built from and by nothing on the base at all.
    ok(
        `LOWER(TRIM()) does NOT find it double-spaced either (${await count(folded(spaced))}) — TRIM is the ends only`,
        (await count(folded(spaced))) === 0
    );
    ok(
        `and the key the gate actually sends finds it (${await count(folded(categoryNameKey(spaced)))})`,
        (await count(folded(categoryNameKey(spaced)))) === 1
    );
} catch (err) {
    pass = false;
    console.log(`  FAIL  the run threw: ${err.message}`);
    console.log(err.stack);
}

// ---------------------------------------------------------------------------
// Cleanup — the rows this run created leave the base inside it.
// ---------------------------------------------------------------------------
console.log("");
console.log("Cleanup:");
const trackedIds = fixtures.ids("categories");
const teardown = await fixtures.teardown({ complete: !incomplete });
console.log(`  ${fixtures.describe(teardown)}`);
if (teardown.leaked.length > 0) {
    pass = false;
    console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
}

// The evidence that they are gone is a read of each id, not the census: "found 0"
// is also what a query against the wrong field returns.
for (const id of trackedIds) {
    let gone = false;
    try {
        await base(TABLE).find(id);
    } catch {
        gone = true;
    }
    ok(`${id} is no longer on the base`, gone);
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);
