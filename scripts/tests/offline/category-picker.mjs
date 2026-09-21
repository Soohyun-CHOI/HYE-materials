// The category picker, on both screens that reach an item (#367).
//
// WHAT THIS IS FOR. #355 gave the request form four ordered levels and locked
// the signer's edit form out of the item entirely, because the name is composed
// from the category and a signer changing one without the other would reach the
// vendor on a purchase order. #367 gives the signer the same picker, and the
// requirement is stronger than "a picker exists there too": the two screens have
// to stay ONE control. Two copies of the JSX would drift a class at a time and
// nothing would fail, which is the shape this file is built to make fail.
//
// FOUR CLAIMS, AND EACH HAS A MUTANT NAMED BESIDE IT. Verified by mutation, in
// the tree, before this text was written:
//   1. `pickCategoryLevel` clears every DEEPER level and nothing else — drop the
//      clearing loop and the level-1 assertion fails.
//   2. Exactly one file under `app/` narrows the tree, and it is the shared
//      component — re-inline the picker in either form and the count is 2.
//   3. `refuseUnsettledCategory` tells four states apart — return a constant and
//      the first assertion fails before any per-state detail is read.
//   4. No call site composes an item name from a label except through
//      `categoryItemFields` — spell `itemName: category.label` in either action
//      and the count is above 0. Why it is not also `.itemName` since #416 is on
//      `itemNameByHand`.
//
// The anti-vacuity is inside 3 rather than beside it: "no refusal" and "the
// predicate cannot see anything" are the same result, so the first thing asked is
// whether the four inputs produce more than one answer at all.
//
// WHAT IT CANNOT SEE is the screen. Whether the four selects render, whether a
// level disables when its parent is unpicked, and whether the two forms LOOK
// alike are browser facts this tier never reaches — they are measured in the
// pull request. What it holds is that there is one implementation to look at.

import { listJsFiles, parseFile, REPO_ROOT, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import {
    CATEGORY_LEVELS,
    CATEGORY_PICKER_COPY,
    categoryItemFields,
    pickCategoryLevel,
    refuseUnsettledCategory,
} from "../../../lib/materialCategory.js";

export const title = "Category picker — one control on both item screens (#367)";

const COMPONENT = "app/components/CategoryPicker.js";
const FORMS = ["app/prs/new/PRForm.js", "app/prs/[prId]/EditAndContinueForm.js"];
const ACTIONS = ["app/prs/new/actions.js", "app/prs/[prId]/actions.js"];

const FULL = ["01", "0101", "0101001", "0101001001"];

/** How many times a file calls a named function. */
function callCount(ast, name) {
    let n = 0;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        if ((node.callee?.name ?? node.callee?.property?.name) === name) n += 1;
    });
    return n;
}

/**
 * `itemName: <anything>.label` assignments — the pair spelled by hand.
 *
 * **IT STAYS ON `.label` AFTER #416, AND WIDENING IT TO `.itemName` WAS TRIED AND
 * REVERTED.** The pair froze the category's label until that issue and freezes its
 * item name now, so the obvious move is to flag the new field too — and it flags
 * `itemName: item.itemName` in `app/prs/new/actions.js`, which is a parsed ROW
 * being handed to `createItem` rather than a name composed from a category. The
 * AST cannot tell the two apart: both are `<identifier>.itemName`, and which one
 * it is depends on what the identifier holds. A guard with a false positive gets
 * an exemption list, which is the shape this repository refuses.
 *
 * WHAT STILL HOLDS THE RULE, since this half no longer can: `categoryItemFields`
 * is pinned by value on a fixture whose label and item name DIFFER, and both
 * actions are asserted to call it. A third call site that composed a name from a
 * category would have to route through the same function to write the pair at
 * all. `.label` is kept because it is unambiguous — a label is a category's and
 * nothing else's — and because it is the spelling somebody copying a pre-#416
 * call site would write.
 */
function itemNameByHand(ast) {
    const found = [];
    walk(ast, (node) => {
        if (node.type !== "Property") return;
        if ((node.key?.name ?? node.key?.value) !== "itemName") return;
        if (node.value?.type !== "MemberExpression") return;
        if (node.value.property?.name === "label") found.push("itemName: …label");
    });
    return found;
}

export function run({ check, log, assert }) {
    log("picking a level clears what was chosen under it:");
    // The rule #355 wrote into a form and #367 moved into the pure module. Level
    // 1 is the sharp case: three codes have to go, and they are exactly the ones
    // chosen inside a branch nobody is looking at any more.
    check(
        "  re-picking level 1 keeps one code",
        pickCategoryLevel(FULL, 0, "02").join(","),
        "02,,,"
    );
    check(
        "  re-picking level 2 keeps two",
        pickCategoryLevel(FULL, 1, "0102").join(","),
        "01,0102,,"
    );
    check(
        "  re-picking the leaf keeps all four",
        pickCategoryLevel(FULL, 3, "0101001002").join(","),
        "01,0101,0101001,0101001002"
    );
    // Clearing is picking the blank option, which is how a reader resets a row —
    // and it must not leave the deeper codes standing behind an empty control.
    check("  clearing level 1 clears the row", pickCategoryLevel(FULL, 0, "").join(","), ",,,");
    check(
        "  a short row still comes back with four levels",
        pickCategoryLevel(["01"], 1, "0101").length,
        CATEGORY_LEVELS.length
    );
    check("  and so does no row at all", pickCategoryLevel(undefined, 0, "01").join(","), "01,,,");

    log("");
    log("one implementation of the control, which is what keeps the screens alike:");
    const component = parseFile(COMPONENT);
    check(`  ${COMPONENT} narrows the tree`, callCount(component.ast, "narrowCategories") > 0, true);
    check(`  ${COMPONENT} clears through the rule`, callCount(component.ast, "pickCategoryLevel") > 0, true);
    // THE COUNT IS OVER THE WHOLE OF `app/`, NOT OVER THE TWO FORMS. A third
    // screen reaching for the tree would be the next place this control gets
    // copied, and naming the two forms would not see it.
    const narrowers = appFiles().filter((rel) => callCount(parseFile(rel).ast, "narrowCategories") > 0);
    check(
        `  files under app/ that narrow the tree${narrowers.length ? ` (${narrowers.join(", ")})` : ""}`,
        narrowers.join(","),
        COMPONENT
    );
    for (const form of FORMS) {
        const { ast } = parseFile(form);
        check(`  ${form} renders the shared picker`, callCount(ast, "CategoryPicker") + jsxUses(ast), 1);
    }

    log("");
    log("a half-picked category cannot be saved, and an untouched one can:");
    const resolved = { recordId: "recCat", label: "A > B", itemName: "B, A" };
    const answers = new Set(
        [
            refuseUnsettledCategory({ chosen: FULL, hadCategory: true, resolved }),
            refuseUnsettledCategory({ chosen: ["01", "0101", "", ""], hadCategory: true, resolved: null }),
            refuseUnsettledCategory({ chosen: ["", "", "", ""], hadCategory: false, resolved: null }),
        ].map((r) => r?.key ?? "(allowed)")
    );
    // FIRST, THAT THE PREDICATE ANSWERS AT ALL. A rule that always allows and a
    // rule that always refuses both leave every screen rendering; the first ships
    // rows whose category disagrees with their name, the second makes the edit
    // turn unusable on a request nobody has fixed. Either passes every assertion
    // below that is about only one state.
    check("  the states do not collapse into one answer", answers.size, 2);
    check(
        "  a settled pick is allowed",
        refuseUnsettledCategory({ chosen: FULL, hadCategory: true, resolved }),
        null
    );
    check(
        "  a row that never had one and was not touched is allowed",
        refuseUnsettledCategory({ chosen: ["", "", "", ""], hadCategory: false, resolved: null }),
        null
    );
    check(
        "  a half-picked row is refused",
        refuseUnsettledCategory({ chosen: ["01", "0101", "", ""], hadCategory: false, resolved: null })?.key,
        CATEGORY_PICKER_COPY.unsettled.key
    );
    // The clause that makes clearing a category a refusal rather than a silent
    // revert to the stored one — nothing is picked, so only `hadCategory` tells
    // this row from the one above it.
    check(
        "  a cleared row is refused",
        refuseUnsettledCategory({ chosen: ["", "", "", ""], hadCategory: true, resolved: null })?.key,
        CATEGORY_PICKER_COPY.unsettled.key
    );
    // A leaf the catalog has since lost arrives here as a complete pick that
    // resolved to nothing, and takes the same refusal and the same instruction.
    check(
        "  a leaf the catalog no longer has is refused",
        refuseUnsettledCategory({ chosen: FULL, hadCategory: true, resolved: null })?.key,
        CATEGORY_PICKER_COPY.unsettled.key
    );
    check(
        "  and the two screens' refusals are different sentences",
        CATEGORY_PICKER_COPY.unsettled.text === CATEGORY_PICKER_COPY.incomplete.text,
        false
    );

    log("");
    log("the category and the name it composes are written by one expression:");
    check(
        "  categoryItemFields carries both",
        Object.keys(categoryItemFields(resolved)).sort().join(","),
        "categoryRecordId,itemName"
    );
    // #416 — the category's OWN name, not its composed path. Both are on the
    // fixture and they differ, so this cannot pass by the two being equal.
    check("  and the name is the category's item name", categoryItemFields(resolved).itemName, resolved.itemName);
    check("  which is not its label", categoryItemFields(resolved).itemName === resolved.label, false);
    let handSpelled = [];
    for (const action of ACTIONS) {
        const { ast } = parseFile(action);
        handSpelled = handSpelled.concat(itemNameByHand(ast).map(() => action));
    }
    // WHAT THIS PREVENTS IS THE THIRD CALL SITE. Both of today's go through the
    // pair; a fourth screen that writes an item would be written by copying one
    // of them, and copying the two assignments apart is how they come to
    // disagree again.
    check(
        `  call sites composing a name by hand${handSpelled.length ? ` (${handSpelled.join(", ")})` : ""}`,
        handSpelled.length,
        0
    );
    for (const action of ACTIONS) {
        const { ast } = parseFile(action);
        check(`  ${action} writes the pair through it`, callCount(ast, "categoryItemFields") > 0, true);
    }

    log("");
    log("every word the picker says comes from the copy constant:");
    // The component must hold no sentence of its own — `scripts/screen-strings.mjs`
    // and the vocabulary checks walk copy constants and cannot see text inside a
    // component, which is the gap docs/briefs/strings/README.md measures.
    const literals = [];
    walk(component.ast, (node) => {
        if (node.type === "Literal" && typeof node.value === "string" && /\s\w+\s/.test(node.value)) {
            literals.push(node.value);
        }
    });
    const prose = literals.filter((text) => !text.includes("-") || /[.?!]/.test(text));
    check(
        `  sentences written into the component${prose.length ? ` (${prose.join(" | ")})` : ""}`,
        prose.length,
        0
    );
    assert(
        "  the copy carries a sentence for a row whose category was cleared",
        CATEGORY_PICKER_COPY.cleared("X").text.includes("X")
    );
}

/** Every `.js` under `app/`, repo-relative and posix-spelled. */
function appFiles() {
    const root = `${toPosix(REPO_ROOT)}/`;
    return listJsFiles(`${REPO_ROOT}/app`).map((abs) => toPosix(abs).slice(root.length));
}

/** `<CategoryPicker …>` uses, which acorn-jsx reports as JSXIdentifier. */
function jsxUses(ast) {
    let n = 0;
    walk(ast, (node) => {
        if (node.type === "JSXOpeningElement" && node.name?.name === "CategoryPicker") n += 1;
    });
    return n;
}

if (isMain(import.meta.url)) standalone(title, run);
