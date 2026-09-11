// What makes two ordered items the same material (#356).
//
// Pinned because this rule decides whether a company that buys one thing twice
// gets one `Materials` row or two — and a split is silent, since both rows look
// correct on their own and only the price history and the quantity rollups
// behind them are wrong. It had three implementations before #356 and they
// agreed by inspection; this file holds the one they collapsed into, and the
// source-shape half holds that they actually did collapse rather than that one
// of them happens to call it.
//
// WHAT THIS TIER CANNOT ASK. The third implementation is an Airtable formula —
// `getMaterialByKey`'s `filterByFormula` — and no offline check can evaluate it.
// What is checkable here is that the formula is BUILT from the same parts
// function, and which fields it names; whether Airtable's `LOWER(TRIM(...))`
// agrees with JavaScript's `.toLowerCase()` on a live row is
// `verify-materials-cache-18.mjs`'s, per `docs/notes/verification.md`'s rule
// that a judgment living on the Airtable side needs a credentialed comparison.
//
// lib/materialIdentity.js imports only lib/itemNaming.js, with the extension
// spelled out, which is what lets this be offline.

import { materialIdentityKey, materialIdentityParts } from "../../../lib/materialIdentity.js";
import { callPassesProperty, callsTo, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material identity — Category + Size + Unit (#356)";

const CODE = "0102001017";
const OTHER_CODE = "0102010006";

/** Every `.join("::")` in a file — the shape a hand-rolled identity key takes. */
function joinedKeys(ast) {
    const found = [];
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        if (node.callee?.type !== "MemberExpression" || node.callee.property?.name !== "join") return;
        if (node.arguments[0]?.value === "::") found.push(node);
    });
    return found;
}

/** The text of the `filterByFormula` template inside one function node. */
function formulaText(fnNode) {
    let text = null;
    walk(fnNode, (node) => {
        if (node.type !== "Property") return;
        if (node.key?.name !== "filterByFormula" && node.key?.value !== "filterByFormula") return;
        if (node.value?.type !== "TemplateLiteral") return;
        text = node.value.quasis.map((q) => q.value.raw).join("<interpolated>");
    });
    return text;
}

export function run({ check, log, assert }) {
    log("what folds — two typings of one material are one key:");
    // A SIZE WITH LETTERS IN IT, and that is not incidental: this read `3/4"`
    // against `'3/4"'.toUpperCase()` first, which is the same string, so the
    // assertion passed without the fold doing anything. Found by mutation —
    // removing `.toLowerCase()` from the key left it green.
    check(
        "Size case folds",
        materialIdentityKey({ categoryCode: CODE, size: "SCH 40 PVC", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "sch 40 pvc", unit: "EA" }),
        true
    );
    check(
        "an internal whitespace run in Size collapses",
        materialIdentityKey({ categoryCode: CODE, size: "SCH  40", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "SCH 40", unit: "EA" }),
        true
    );
    check(
        "Size is trimmed",
        materialIdentityKey({ categoryCode: CODE, size: "  2in  ", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }),
        true
    );
    check(
        "Unit case folds — the DRUM case, an option added by hand in Airtable",
        materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "ea" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }),
        true
    );
    check(
        "a leading space on the code is trimmed",
        materialIdentityKey({ categoryCode: ` ${CODE} `, size: "", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "", unit: "EA" }),
        true
    );
    check(
        "a blank Size is a key like any other, not a refusal",
        typeof materialIdentityKey({ categoryCode: CODE, size: "", unit: "EA" }),
        "string"
    );

    // ANTI-VACUITY. Every assertion above is an EQUALITY, and a key function
    // that returned one constant would pass all of them — so these are the
    // pairs that must come out different. Without them this file reads as
    // coverage while asserting nothing about what the key separates.
    log("");
    log("what separates — and this half is why the half above means anything:");
    check(
        "a different category is a different material",
        materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: OTHER_CODE, size: "2in", unit: "EA" }),
        false
    );
    check(
        "a different Size is a different material",
        materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "3in", unit: "EA" }),
        false
    );
    check(
        "a different Unit is a different material",
        materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "FT" }),
        false
    );
    check(
        "a blank Size and a Size of \"0\" are not the same material",
        materialIdentityKey({ categoryCode: CODE, size: "", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "0", unit: "EA" }),
        false
    );

    log("");
    log("no category is a refusal, not a fourth key:");
    // A key built from an empty code would make EVERY category-less ordered item
    // one material — the whole-table answer `orByField`'s empty-list `FALSE()`
    // exists to avoid one module over.
    check("no code at all", materialIdentityKey({ size: "2in", unit: "EA" }), null);
    check("an empty code", materialIdentityKey({ categoryCode: "", size: "2in", unit: "EA" }), null);
    check("a whitespace code", materialIdentityKey({ categoryCode: "   ", size: "2in", unit: "EA" }), null);
    check("null", materialIdentityKey({ categoryCode: null, size: "2in", unit: "EA" }), null);

    log("");
    log("the STORED value keeps its case — it is printed to the vendor (#18):");
    check(
        "Size is normalized but not lower-cased",
        materialIdentityParts({ categoryCode: CODE, size: "  SCH  40  PVC ", unit: "EA" }).size,
        "SCH 40 PVC"
    );
    check(
        "Unit keeps the canonical spelling",
        materialIdentityParts({ categoryCode: CODE, size: "", unit: " EA " }).unit,
        "EA"
    );
    check(
        "and the key lower-cases it while the part does not",
        materialIdentityKey({ categoryCode: CODE, size: "SCH 40", unit: "EA" }).includes("sch 40"),
        true
    );

    // --- ONE IMPLEMENTATION, NOT THREE (AST) -----------------------------
    //
    // The rule can be correct here and still be re-derived at a call site,
    // which is the divergence this module exists to remove — and nothing
    // behavioral would notice, because the two would agree until the day
    // somebody edited one.
    log("");
    log("the three sites take the rule from this module (AST):");

    const materials = parseFile("lib/airtable/materials.js");
    const cache = parseFile("lib/materialsCache.js");

    const importsFrom = (ast, source, name) => {
        let found = false;
        walk(ast, (node) => {
            if (node.type !== "ImportDeclaration") return;
            if (!node.source.value?.includes(source)) return;
            if (node.specifiers.some((s) => s.imported?.name === name)) found = true;
        });
        return found;
    };

    assert(
        "lib/airtable/materials.js imports materialIdentityKey",
        importsFrom(materials.ast, "materialIdentity", "materialIdentityKey")
    );
    assert(
        "  and materialIdentityParts, which the query's values come from",
        importsFrom(materials.ast, "materialIdentity", "materialIdentityParts")
    );
    assert(
        "lib/materialsCache.js imports materialIdentityKey",
        importsFrom(cache.ast, "materialIdentity", "materialIdentityKey")
    );
    check("neither builds a \"::\" key of its own — materials.js", joinedKeys(materials.ast).length, 0);
    check("  materialsCache.js", joinedKeys(cache.ast).length, 0);

    // The detector has to be seen finding the shape it reports absent, or the
    // two counts above are the same result as a broken walk (#290's move:
    // plant the violation here rather than commit one).
    const planted = parseSource(
        `const k = ["material", code, size.toLowerCase(), unit].join("::");`,
        "<planted>"
    );
    check("  and the detector finds a planted one", joinedKeys(planted.ast).length, 1);

    // --- WHAT THE QUERY AND THE WRITE NAME (AST) -------------------------
    log("");
    log("the name is neither matched on nor written any more (AST):");

    const lookup = resolveFunction(materials.ast, "getMaterialByKey");
    assert("getMaterialByKey resolves", Boolean(lookup));
    const formula = lookup ? formulaText(lookup) : null;
    assert("  and its filterByFormula is a template literal", typeof formula === "string");
    assert("  which matches on {Category Code}", Boolean(formula?.includes("{Category Code}")));
    // `& ""` is how a single-element lookup reaches string context on this base;
    // without it the comparison is against an array and matches nothing.
    assert('  coerced with & "" first', Boolean(formula?.includes('{Category Code} & ""')));
    assert("  and names {Item Name} nowhere", !formula?.includes("{Item Name}"));
    assert("  while still folding {Size}", Boolean(formula?.includes("LOWER(TRIM({Size}))")));
    assert("  and {Unit}", Boolean(formula?.includes("LOWER(TRIM({Unit}))")));

    const upsert = resolveFunction(materials.ast, "upsertMaterial");
    assert("upsertMaterial resolves", Boolean(upsert));
    const creates = upsert ? callsTo(upsert, "create") : [];
    check("  and creates exactly one record", creates.length, 1);
    // Writing a computed field is a 422 from Airtable, and
    // refreshMaterialsCacheForPO catches it per entry — so the symptom is an
    // ordered item that never gets its `Material` link rather than a failure
    // anyone sees. This assertion is the thing that would notice.
    assert(
        '  writing no "Item Name", which is a lookup since #356',
        creates.length === 1 && !callPassesProperty(creates[0], "Item Name")
    );
    assert(
        "  and writing the Category link instead",
        creates.length === 1 && callPassesProperty(creates[0], "Category")
    );
    assert(
        "  with Size beside it",
        creates.length === 1 && callPassesProperty(creates[0], "Size")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
