// Two identical item rows are one PR Item (#170) — the key, its normalization, the
// sum, and the one structural fact that keeps the guarantee in the action.
//
// THE QUIET MUTANT IS NOT MERGING, and it is asserted first. This rule's failure mode
// is that the screen and the record go back to exactly what shipped before it, with
// nothing to see: every PR whose rows are already distinct is unaffected, no other
// check in this repository reads these keys, and a form that quietly writes two rows
// looks like a form that was given two rows. It is the station #237's `always agree`,
// #242's removed narrowing, #241's always-silent list and #238's unfolded table stand
// at. `noMerge` below is built and run against the real rule on named rows.
//
// WHAT THIS TIER CANNOT ASSERT, and the issue says so: existing PRs are not
// backfilled, so "no PR on this base carries the same item twice" is not a property
// of the base and no check may claim it. What is checkable is the rule over rows and
// the fact that the write path cannot get rows the rule has not seen — the second is
// a source-shape assertion, and it is the only place the GUARANTEE (as against the
// arithmetic) can be pinned without a dev server: a Server Action is directly
// callable, so the form previewing the same rule proves nothing about what is
// written.
//
// THE NORMALIZATION IS #18's AND THE ASYMMETRY IS THE POINT. Name and Size compare
// case-insensitively because `getMaterialByKey` looks a material up with
// `LOWER(TRIM(...))`, so two spellings are ONE material and leaving them as two rows
// would produce the very state this issue removes. A Remark keeps its case, because
// nothing forces otherwise and it is prose a vendor reads. Both directions are
// asserted, since a later pass "tidying" one into the other is the plausible edit.

import { callsFunction, parseFile, resolveFunction } from "./_ast.mjs";
import { normalizeItemText } from "../../../lib/itemNaming.js";
import {
    PR_ITEM_MERGE_COPY,
    describeMerge,
    isEmptyItemRow,
    mergeIdenticalItems,
    mergeKey,
} from "../../../lib/prItemMerge.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Identical PR item rows merge on save (#170)";

/** One form row, in the shape `PRForm`'s `itemsJson` carries. */
const row = ({
    itemName = "Widget",
    size = '1"',
    unit = "EA",
    qty = "5",
    unitPrice = "12",
    remark = "",
    quotationIndex = null,
} = {}) => ({ itemName, size, unit, qty, unitPrice, remark, quotationIndex });

const EMPTY = { itemName: "", size: "", unit: "", qty: "", unitPrice: "", remark: "", quotationIndex: null };

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — not merging is the form as it shipped before this:");
    const twoIdentical = [row({ qty: "5" }), row({ qty: "7" })];
    const noMerge = (rows) => [...(rows || [])];
    const merged = mergeIdenticalItems(twoIdentical);
    check("two identical rows are written as one", merged.length, 1);
    assert(
        "  so the no-merge mutant disagrees with the rule on them",
        noMerge(twoIdentical).length !== merged.length
    );
    check("  with the quantities added", merged[0].qty, 12);
    // The other direction, so the rule is not "merge everything": the issue's own
    // stated exception.
    const priceDiffers = [row({ qty: "5" }), row({ qty: "3", unitPrice: "13" })];
    check("a row differing only in unit price stays its own", mergeIdenticalItems(priceDiffers).length, 2);
    check("  and keeps its quantity", mergeIdenticalItems(priceDiffers)[1].qty, "3");

    // -----------------------------------------------------------------------
    log("");
    log("the six fields, one at a time — each difference keeps two rows:");
    const base = row();
    const cases = [
        ["item name", row({ itemName: "Gadget" })],
        ["size", row({ size: '2"' })],
        ["unit", row({ unit: "FT" })],
        ["unit price", row({ unitPrice: "13" })],
        ["remark", row({ remark: "urgent" })],
        ["quotation", row({ quotationIndex: 1 })],
    ];
    for (const [name, other] of cases) {
        check(`  a different ${name}`, mergeIdenticalItems([base, other]).length, 2);
    }
    assert(
        "and nothing else does — a difference outside the key merges anyway",
        mergeIdenticalItems([row({ qty: "5" }), row({ qty: "9" })]).length === 1
    );

    // -----------------------------------------------------------------------
    log("");
    log("normalization follows #18's lookup, and the remark deliberately does not:");
    check(
        "`Pipe` and `pipe` are one item, because one Material is what they reach",
        mergeIdenticalItems([row({ itemName: "Pipe" }), row({ itemName: "pipe" })]).length,
        1
    );
    check(
        "  and the FIRST spelling is what gets written",
        mergeIdenticalItems([row({ itemName: "Pipe" }), row({ itemName: "pipe" })])[0].itemName,
        "Pipe"
    );
    check(
        "a trailing space is not a second item",
        mergeIdenticalItems([row({ itemName: "Pipe" }), row({ itemName: "Pipe " })]).length,
        1
    );
    check(
        "  nor is a doubled internal space",
        mergeIdenticalItems([row({ size: "1/2 in" }), row({ size: "1/2  in" })]).length,
        1
    );
    check(
        "size is case-insensitive too, being half the same key",
        mergeIdenticalItems([row({ size: "SCH 40" }), row({ size: "sch 40" })]).length,
        1
    );
    check(
        "a remark keeps its case — two voices are not one",
        mergeIdenticalItems([row({ remark: "URGENT" }), row({ remark: "urgent" })]).length,
        2
    );
    check(
        "  but its whitespace is normalized, like every other text field",
        mergeIdenticalItems([row({ remark: "hold  it" }), row({ remark: " hold it " })]).length,
        1
    );
    // The two rules are read off one another here, so a later pass that lower-cases
    // the remark or preserves the name's case fails on this line rather than on a
    // string somewhere.
    assert(
        "the asymmetry is the assertion, not a side effect",
        mergeKey(row({ itemName: "Pipe" })) === mergeKey(row({ itemName: "pipe" })) &&
            mergeKey(row({ remark: "A" })) !== mergeKey(row({ remark: "a" }))
    );
    assert(
        "and the text rule is #18's own function, not a copy of it",
        mergeKey(row({ itemName: "  Pipe  x  " })).startsWith(
            normalizeItemText("  Pipe  x  ").toLowerCase()
        )
    );

    // -----------------------------------------------------------------------
    log("");
    log("the unit price is a number, and a missing one is a value:");
    check("`10` and `10.00` are one price", mergeIdenticalItems([row({ unitPrice: "10" }), row({ unitPrice: "10.00" })]).length, 1);
    check("  and `10.5` is not `10`", mergeIdenticalItems([row({ unitPrice: "10.5" }), row({ unitPrice: "10" })]).length, 2);
    // A Draft is saved with no per-item validation, so a price-less row is reachable;
    // `NaN !== NaN` would have left two of them unmerged forever.
    check(
        "two rows with no price at all merge",
        mergeIdenticalItems([row({ unitPrice: "" }), row({ unitPrice: "" })]).length,
        1
    );
    check(
        "  as do two whose price is unparseable",
        mergeIdenticalItems([row({ unitPrice: "abc" }), row({ unitPrice: "abc" })]).length,
        1
    );
    assert(
        "  and a priced row is not the same as a price-less one",
        mergeKey(row({ unitPrice: "" })) !== mergeKey(row({ unitPrice: "0" }))
    );

    // -----------------------------------------------------------------------
    log("");
    log("quantities: summed as numbers, and a blank one invents nothing:");
    check("three identical rows", mergeIdenticalItems([row({ qty: "1" }), row({ qty: "2" }), row({ qty: "4" })])[0].qty, 7);
    check("  fractional quantities add", mergeIdenticalItems([row({ qty: "1.5" }), row({ qty: "2.25" })])[0].qty, 3.75);
    check(
        "a blank quantity contributes nothing but does not erase the other",
        mergeIdenticalItems([row({ qty: "5" }), row({ qty: "" })])[0].qty,
        5
    );
    check(
        "  and two blank quantities stay blank rather than becoming 0",
        mergeIdenticalItems([row({ qty: "" }), row({ qty: "" })])[0].qty,
        ""
    );

    // -----------------------------------------------------------------------
    log("");
    log("an untouched row takes no part:");
    check("two empty rows stay two", mergeIdenticalItems([{ ...EMPTY }, { ...EMPTY }]).length, 2);
    check("  and are keyed as nothing", mergeKey({ ...EMPTY }), null);
    assert("  which is the write path's own test, moved rather than restated", isEmptyItemRow({ ...EMPTY }));
    assert("  a row with only a Unit picked is NOT empty", !isEmptyItemRow({ ...EMPTY, unit: "EA" }));
    check(
        "an empty row between two identical ones does not block the merge",
        mergeIdenticalItems([row({ qty: "5" }), { ...EMPTY }, row({ qty: "5" })]).length,
        2
    );
    check("no rows merges to nothing", mergeIdenticalItems([]).length, 0);
    check("undefined does not throw", mergeIdenticalItems(undefined).length, 0);

    // -----------------------------------------------------------------------
    log("");
    log("order is the requester's own:");
    const ordered = mergeIdenticalItems([
        row({ itemName: "Widget", qty: "1" }),
        row({ itemName: "Gadget", qty: "2" }),
        row({ itemName: "Widget", qty: "3" }),
    ]);
    check("first appearance wins", ordered.map((r) => r.itemName).join(","), "Widget,Gadget");
    check("  and the later row folded into the first", ordered[0].qty, 4);

    // -----------------------------------------------------------------------
    log("");
    log("what the form says before the save:");
    check("nothing to merge, nothing to say", describeMerge([base]).merging, 0);
    check("one row disappearing", describeMerge(twoIdentical).merging, 1);
    check(
        "  reads as two items becoming one",
        PR_ITEM_MERGE_COPY.willMerge(1).text,
        "Two items are identical — they will be saved as one item, with the quantities added."
    );
    check("two rows disappearing", describeMerge([base, row(), row()]).merging, 2);
    assert(
        "  and the plural counts the rows that go, not a group",
        PR_ITEM_MERGE_COPY.willMerge(2).text.startsWith("2 items repeat an item above them")
    );
    // Two separate pairs: three rows do NOT agree with each other, so a sentence
    // saying `3 items are identical` would be false. This is why the count is the
    // rows that disappear.
    const twoPairs = [row(), row(), row({ unitPrice: "13" }), row({ unitPrice: "13" })];
    check("two pairs merge to two rows", mergeIdenticalItems(twoPairs).length, 2);
    check("  with two rows disappearing", describeMerge(twoPairs).merging, 2);
    check("the copy key is stable for a call site", PR_ITEM_MERGE_COPY.willMerge(1).key, "will-merge");

    // -----------------------------------------------------------------------
    log("");
    log("the guarantee is the action's, asserted on the source:");
    const { ast } = parseFile("app/prs/new/actions.js");
    const parse = resolveFunction(ast, "parseFormState");
    assert("parseFormState exists and could be resolved", Boolean(parse));
    assert("  and it merges the items it parses", callsFunction(parse, "mergeIdenticalItems"));
    // Both actions read their items through that one function, so nothing downstream
    // can be handed rows the rule has not seen — including `findDuplicatePR`, whose
    // key is per row.
    for (const name of ["saveDraftAction", "createPRAction"]) {
        const fn = resolveFunction(ast, name);
        assert(`${name} takes its items from parseFormState`, callsFunction(fn, "parseFormState"));
        assert(`  and merges nowhere else itself`, !callsFunction(fn, "mergeIdenticalItems"));
    }
    // ANTI-VACUITY: the two assertions above would both pass if `callsFunction` were
    // blind, so one call it must NOT find is checked on the same node.
    assert(
        "and the source check can tell a present call from an absent one",
        callsFunction(parse, "mergeIdenticalItems") && !callsFunction(parse, "mergeNothingAtAll")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
