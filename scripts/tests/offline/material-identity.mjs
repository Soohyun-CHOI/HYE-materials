// What makes two ordered items the same material (#356, #629), and the one line an
// item is named by (#629).
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
// lib/materialIdentity.js imports only lib/typedText.js, with the extension
// spelled out, which is what lets this be offline.

import { itemLabel, materialIdentityKey, materialIdentityParts } from "../../../lib/materialIdentity.js";
import { callPassesProperty, callsTo, parseFile, parseSource, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Material identity — Category + Size + Maker + Unit (#356, #629)";

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
    // #629 — the maker folds as the size does, on the same two counts.
    check(
        "Maker case folds",
        materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "KITZ", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "Kitz", unit: "EA" }),
        true
    );
    check(
        "Maker is trimmed and an internal whitespace run collapses",
        materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "  Nibco   Inc ", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "Nibco Inc", unit: "EA" }),
        true
    );
    // THE HALF EVERY MATERIAL MADE BEFORE #629 STANDS ON: an item naming no maker,
    // however the caller says so, has the key a maker-less row has.
    check(
        "an absent Maker, an empty one, a blank one and null are one key",
        new Set([
            materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }),
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "", unit: "EA" }),
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "   ", unit: "EA" }),
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: null, unit: "EA" }),
        ]).size,
        1
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
        "a different Maker is a different material (#629)",
        materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "Kitz", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "Nibco", unit: "EA" }),
        false
    );
    check(
        "a Maker is a different material from none",
        materialIdentityKey({ categoryCode: CODE, size: "2in", maker: "Kitz", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "2in", unit: "EA" }),
        false
    );
    // A size and a maker are two axes, not one string: the same word in the other
    // slot is a different material.
    check(
        "a word as the Size is not that word as the Maker",
        materialIdentityKey({ categoryCode: CODE, size: "Kitz", unit: "EA" }) ===
            materialIdentityKey({ categoryCode: CODE, size: "", maker: "Kitz", unit: "EA" }),
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
        "Maker is normalized but not lower-cased (#629)",
        materialIdentityParts({ categoryCode: CODE, size: "", maker: "  NIBCO   Inc ", unit: "EA" }).maker,
        "NIBCO Inc"
    );
    check(
        "an absent Maker is the empty string, the value a maker-less row holds",
        materialIdentityParts({ categoryCode: CODE, size: "", unit: "EA" }).maker,
        ""
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
    assert("  and {Maker} (#629)", Boolean(formula?.includes("LOWER(TRIM({Maker}))")));
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
    assert(
        "  and Maker (#629)",
        creates.length === 1 && callPassesProperty(creates[0], "Maker")
    );

    // --- THE ONE LINE AN ITEM IS NAMED BY (#629) -------------------------
    log("");
    log("the one line an item is named by:");
    check("a name and a size", itemLabel({ itemName: "Ball Valve", size: '2"' }), 'Ball Valve 2"');
    check("then a comma and the maker", itemLabel({ itemName: "Ball Valve", size: '2"', maker: "Kitz" }), 'Ball Valve 2", Kitz');
    check("no size: the maker after the name", itemLabel({ itemName: "Ball Valve", maker: "Kitz" }), "Ball Valve, Kitz");
    check("no name: the size, then the maker", itemLabel({ size: '2"', maker: "Kitz" }), '2", Kitz');
    check("the maker alone", itemLabel({ maker: "Kitz" }), "Kitz");
    check("nothing at all is the empty string, for the caller's own word", itemLabel({}), "");
    check("and a missing item too", itemLabel(undefined), "");
    // A name carries commas of its own (`Tube, SUS 304, AP`); the line adds exactly
    // one, before a maker.
    check(
        "a name with commas gains exactly one more, before the maker",
        itemLabel({ itemName: "Tube, SUS 304, AP", size: "1/2in", maker: "Kitz" }),
        "Tube, SUS 304, AP 1/2in, Kitz"
    );

    // --- NO SCREEN JOINS A NAME AND A SIZE BY HAND (AST) -----------------
    //
    // Thirteen call sites did until #629, two of them as one function written twice;
    // a maker added to each would have been thirteen copies of a rule with a comma in
    // it. What is asserted absent is the shape they had — an array holding an
    // `.itemName` and a `.size` member — and the detector is shown finding a planted
    // one, so an empty count is a finding rather than a blind walk.
    log("");
    log("no file joins an item's name and size by hand (AST):");
    // `f?.size` parses as a ChainExpression around the member, so it is unwrapped —
    // two of the thirteen were written that way, and a mutation found the detector
    // blind to them.
    const memberName = (e) => {
        const inner = e?.type === "ChainExpression" ? e.expression : e;
        return inner?.type === "MemberExpression" ? inner.property?.name : null;
    };
    const handJoined = (ast) => {
        let n = 0;
        walk(ast, (node) => {
            if (node.type !== "ArrayExpression") return;
            const members = node.elements.map(memberName);
            if (members.includes("itemName") && members.includes("size")) n++;
        });
        return n;
    };
    const handJoinSites = [];
    for (const file of HAND_JOIN_SCOPE) {
        const count = handJoined(parseFile(file).ast);
        if (count) handJoinSites.push(`${file} (${count})`);
    }
    check(`  across the ${HAND_JOIN_SCOPE.length} files that name an item`, handJoinSites.join(", ") || "none", "none");
    check(
        "  and the detector finds a planted one",
        handJoined(parseSource(`const l = [row.itemName, row.size].filter(Boolean).join(" ");`, "<planted>").ast),
        1
    );
    check(
        "  and one written with optional chaining",
        handJoined(parseSource(`const l = [f?.itemName, f?.size].filter(Boolean).join(" ");`, "<planted>").ast),
        1
    );
}

/**
 * The files that named an item by hand before #629 and name one through `itemLabel`
 * now — named rather than swept, since a sweep of every file asks about comments and
 * fixtures as much as about screens.
 */
const HAND_JOIN_SCOPE = [
    "lib/deliveryAllocation.js",
    "lib/invoiceOrderBreakdown.js",
    "lib/overage.js",
    "lib/overage.server.js",
    "lib/poDocuments.js",
    "app/deliveries/[deliveryId]/page.js",
    "app/invoices/[invoiceId]/page.js",
    "app/invoices/new/InvoiceForm.js",
    "app/prs/OverageStrip.js",
];

if (isMain(import.meta.url)) standalone(title, run);
