// A demo seed picks its categories from the catalog, and proves it did (#358).
//
// THE HOLE THIS CLOSES IS THE ONE #355 LEFT OPEN ON PURPOSE. `createItem`
// accepts a request item with no `Category` and has to: a Draft saves without
// per-item validation (#72), and a half-picked row is a state a requester is
// allowed to save. So the service layer cannot refuse the shape a forgetful seed
// produces — and after #356 keys `upsertMaterial` on the category, such a row
// generates a material with no identity. Seven seeds were fixed in #358; the
// eighth is the problem, and an author who never learns the rule exists is the
// mechanism.
//
// SO THE ASSERTION IS ABOUT THE CALL, NOT ABOUT THE ARGUMENT. "Every
// `createItem` passes a category" is the obvious rule and it is wrong: it would
// forbid the one row `docs/briefs/prs-new.md` says the form has to be able to
// show — a Draft item saved before the catalog existed, which opens with nothing
// picked. Buying that back needs an exemption list, which
// `docs/notes/verification.md` refuses on `offline/fixture-cleanup.mjs`'s own
// grounds. What this asks instead is that a seed creating request items goes
// through `_seed_categories.mjs`, and the HELPER holds the count of deliberate
// exceptions. Same division as `_fixtures.mjs` and `fixture-cleanup.mjs` one
// directory over.
//
// IT ALSO CATCHES A TYPO BEFORE THE BASE DOES. The leaf codes are hard-coded so
// two runs of `reset_demo.mjs` produce the same demo; the cost is that a wrong
// code is only found when the seed runs, several hundred operations in. Every
// code is checked against the committed CSV here instead.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync, readFileSync } from "node:fs";
import { callsFunction, parseFile, repoPath, walk } from "./_ast.mjs";
import { parseCsv } from "./material-categories.mjs";
import { CATEGORY_LEAF_CODE } from "../../../lib/materialCategory.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A demo seed picks its categories and proves it (#358)";

const CSV = "scripts/import/material_categories.csv";
const HELPER = "scripts/demo/_seed_categories.mjs";
const VERIFY_HELPER = "scripts/tests/_categories.mjs";
const VERIFIER = "assertItemsHaveCategories";

/**
 * `SEED_CATEGORIES`, PARSED RATHER THAN IMPORTED, for this tier's own boundary:
 * the helper reaches `lib/airtable/client.js`, which throws
 * `Missing AIRTABLE_API_KEY` at module load. `table-field-names.mjs` reads
 * `TABLES` the same way and for the same reason, and `line-vocabulary.mjs`
 * before it — so this is the repository's answer to the situation rather than a
 * new one. The cost is that a computed entry would be invisible here; the
 * literal is asserted to be a plain object of arrays of strings, so a computed
 * one fails rather than passing unseen.
 */
function seedCategoriesFromSource() {
    const { ast } = parseFile(HELPER);
    const out = {};
    let found = false;
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.name !== "SEED_CATEGORIES") return;
        // `Object.freeze({ ... })` — take the object it wraps.
        const object =
            node.init?.type === "CallExpression" ? node.init.arguments[0] : node.init;
        if (object?.type !== "ObjectExpression") return;
        found = true;
        for (const property of object.properties) {
            const key = property.key?.value ?? property.key?.name;
            const list =
                property.value?.type === "CallExpression"
                    ? property.value.arguments[0]
                    : property.value;
            if (!key || list?.type !== "ArrayExpression") continue;
            out[key] = list.elements
                .filter((e) => e?.type === "Literal" && typeof e.value === "string")
                .map((e) => e.value);
        }
    });
    return { entries: out, found };
}

/**
 * `VERIFY_CATEGORY_CODES` out of the credentialed tier's own helper, parsed for
 * the same reason as the object above: `scripts/tests/_categories.mjs` reaches
 * `lib/airtable/client.js`, which throws without credentials.
 *
 * IT IS CHECKED HERE RATHER THAN IN A FILE OF ITS OWN because the question is
 * the same question — is every code real, and does any two claim one path — and
 * the answer has to be computed over BOTH lists at once or the disjointness
 * clause is only about the demo half (#356).
 */
function verifyCategoriesFromSource() {
    const { ast } = parseFile(VERIFY_HELPER);
    let codes = null;
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.name !== "VERIFY_CATEGORY_CODES") return;
        const list = node.init?.type === "CallExpression" ? node.init.arguments[0] : node.init;
        if (list?.type !== "ArrayExpression") return;
        codes = list.elements
            .filter((e) => e?.type === "Literal" && typeof e.value === "string")
            .map((e) => e.value);
    });
    return codes;
}

/**
 * The leaf codes the committed catalog has.
 *
 * Through `material-categories.mjs`'s parser rather than a `split(",")` of its
 * own: the code columns carry no comma, but the NAME columns before them do, so
 * a naive split reads this column off by however many the row happens to have.
 * That was this check's first version and it reported a real code as missing.
 */
function committedLeafCodes() {
    const rows = parseCsv(readFileSync(repoPath(CSV), "utf8"));
    const at = rows[0].indexOf(CATEGORY_LEAF_CODE);
    return new Set(rows.slice(1).map((r) => r[at]).filter(Boolean));
}

/** Every `scripts/demo/*.mjs` that is a seed rather than a helper. */
function seedFiles() {
    return readdirSync(repoPath("scripts/demo"))
        .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
        .sort();
}

export function run({ check, assert, log }) {
    const codes = committedLeafCodes();
    const seeds = seedFiles();
    const { entries: SEED_CATEGORIES, found } = seedCategoriesFromSource();
    assert("SEED_CATEGORIES was parsed out of the helper", found);

    log("the committed catalog was read:");
    assert("leaf codes were parsed from the CSV", codes.size > 0);
    check("  distinct leaf codes", codes.size, 777);

    log("");
    log("every seed that creates request items goes through the helper:");
    const creators = [];
    for (const file of seeds) {
        const { ast } = parseFile(`scripts/demo/${file}`);
        // `callsFunction` rather than `callsTo`, which returns an ARRAY — and an
        // empty array is truthy, so the first version of this reported every
        // file in the directory as a seed that creates request items.
        if (!callsFunction(ast, "createItem")) continue;
        creators.push(file);

        const source = readFileSync(repoPath(`scripts/demo/${file}`), "utf8");
        check(`  ${file} calls ${VERIFIER}`, source.includes(`${VERIFIER}(`), true);
        check(`  ${file} has a category list`, Object.hasOwn(SEED_CATEGORIES, file), true);
    }

    // ANTI-VACUITY. "No seed is missing the call" and "no seed was found at all"
    // are the same result, and the walk is the part that could silently find
    // nothing. The count is typed out so a seed that stops creating items — or a
    // new one that starts — moves it in the same commit.
    log("");
    log("anti-vacuity — the walk really found the seeds:");
    assert("some seed creates request items", creators.length > 0);
    check("  seeds that create request items", creators.length, 7);

    log("");
    log("the lists are disjoint and every code is real:");
    // THE VERIFY TIER'S SLICE IS IN THE SAME COMPARISON, NOT BESIDE IT (#356).
    // A verification run deletes the fixtures it made, and `upsertMaterial`
    // finds-or-creates — so a verify script naming a demo seed's category would
    // upsert onto the seed's own permanent `Materials` row and then delete it,
    // with nothing to say it had gone. Disjointness across the boundary is the
    // thing that prevents it, and it can only be asked over both lists at once.
    const verifyCodes = verifyCategoriesFromSource();
    assert("VERIFY_CATEGORY_CODES was parsed out of the credentialed helper", Array.isArray(verifyCodes));
    const allLists = { ...SEED_CATEGORIES, [VERIFY_HELPER]: verifyCodes ?? [] };

    const seen = new Map();
    let duplicated = [];
    let unknown = [];
    for (const [file, list] of Object.entries(allLists)) {
        for (const code of list) {
            if (seen.has(code)) duplicated.push(`${code} (${seen.get(code)} and ${file})`);
            else seen.set(code, file);
            if (!codes.has(code)) unknown.push(`${code} (${file})`);
        }
    }
    check(
        "no leaf code claimed by two seeds",
        duplicated.length === 0 ? "none" : duplicated.join(", "),
        "none"
    );
    check(
        "no leaf code the catalog does not have",
        unknown.length === 0 ? "none" : unknown.join(", "),
        "none"
    );
    check("  codes allocated in total", seen.size, 95);
    check("  of which the credentialed tier's", verifyCodes?.length ?? 0, 12);

    // Sharing a category is what makes two scenarios each other's delivery
    // candidates (#18), so a seed with fewer categories than scenarios would
    // have to reuse one. The floor is per seed rather than global.
    log("");
    log("each list has enough categories to keep its scenarios apart:");
    for (const [file, list] of Object.entries(allLists)) {
        check(`  ${file}`, list.length > 0, true);
    }
}

if (isMain(import.meta.url)) standalone(title, run);
