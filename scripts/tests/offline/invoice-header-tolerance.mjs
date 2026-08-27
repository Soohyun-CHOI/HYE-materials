// One tolerance decides whether an invoice's total disagrees (#254).
//
// THE QUIET MUTANT IS THE FORM CALLING THE RULE AND STILL BUILDING ITS OWN
// FIGURES, and it is asserted first because it is the state this issue would most
// easily be "fixed" into. Import `checkHeaderVariance`, call it, pass
// `itemsTotal` — the rule is shared, the threshold is single, and the two screens
// go on disagreeing exactly as before. Every other check in this tier stays green
// through it: `invoice-money-terms.mjs` asserts on the `calculatedTotal`
// DECLARATION, which the mutant leaves standing and rendered, so the label under
// the money row still reads correctly while the warning above it compares
// something else.
//
// THE SECOND MUTANT IS SLOWER: the form keeps one threshold branch of its own
// beside the shared call. Two judgments in one file agreeing on almost every
// input, which is what makes it invisible — a reader sees the import and stops
// looking. So no comparison of the header's two figures against a numeric
// literal may survive in that file at all.
//
// WHAT SCOPES THAT SECOND ASSERTION IS THE CONSTANT #254 REFUSED TO MERGE.
// `shippingFeeMismatch` is `Math.abs(...) > 0.01` in the same function and is a
// DIFFERENT comparison — a typed shipping fee against the order's frozen one, two
// figures that should be identical, which is `checkUnitPriceVariance`'s question
// rather than the header's. It has to be seen and allowed, which is why it is
// this file's anti-vacuity for that assertion: a walk that cannot find it cannot
// have found anything.
//
// THE THIRD GROUP IS THE PREMISE THE FIGURE RESTS ON, and it is here rather than
// with the write path because a threshold and the thing that makes it correct
// should fail in the same file. Half a cent is derived from both sides of the
// comparison being whole numbers of cents, and nothing outside the code holds
// that: Airtable's `precision` is a display option, the value the actions read is
// a hidden `itemsJson` rather than a control, and — measured — the controls' own
// step validation does not fire on this form, so a typed `2.5` submits.
//
// WHICH IS WHY THE PREMISE IS ASSERTED AT TWO LEVELS. Both invoice actions refuse
// it with `ITEM_PRECISION_COPY` and both service writers throw. Dropping the
// action half is the mutant that matters here: the guard still holds, the premise
// still holds, and a reader who typed a fractional quantity gets
// `Something went wrong creating the invoice. Please try again.` on an input they
// could have fixed.
//
// WHAT THIS TIER CANNOT SEE, STATED BECAUSE IT IS THE RESIDUE: a hand edit in the
// Airtable UI. A `Qty` of 2.5 typed into a precision-0 field is stored and shown
// as 3, and no check in this repository reads live rows — `verify-variance-15.mjs`
// creates its own whole-number fixtures and compares its own invoice, so it would
// not notice either. The state surfaces only as the screen's own false positive:
// `⚠ Check the total` on a stored invoice whose vendor did nothing but round its
// printed amounts. Closing that needs a credentialed check reading live values,
// which is the shape `verification.md` prescribes for every Airtable-side rule and
// which #254 does not add.

import { readFileSync } from "node:fs";
import {
    ITEM_PRECISION_COPY,
    checkHeaderVariance,
    checkUnitPriceVariance,
    isWholeCentPrice,
    isWholeQty,
    VARIANCE_COPY,
} from "../../../lib/variance.js";
import { parseFile, repoPath, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One tolerance decides whether an invoice's total disagrees (#254)";

const FORM = "app/invoices/new/InvoiceForm.js";
const WRITER = "lib/airtable/invoiceItems.js";
const CREATE_ACTION = "app/invoices/new/actions.js";
const EDIT_ACTION = "app/invoices/[invoiceId]/actions.js";

/** The two figures the header comparison is about, as this form names them. */
const STATED = "vendorStatedTotal";
const CALCULATED = "calculatedTotal";

/** Every identifier name in a subtree. */
function namesIn(node) {
    const out = new Set();
    walk(node, (n) => {
        if (n.type === "Identifier" || n.type === "JSXIdentifier") out.add(n.name);
    });
    return out;
}

/** Every call to `name` in a subtree, as nodes. */
function callsNamed(node, name) {
    const out = [];
    walk(node, (n) => {
        if (n.type !== "CallExpression") return;
        const callee = n.callee;
        const called = callee?.type === "Identifier" ? callee.name : callee?.property?.name;
        if (called === name) out.push(n);
    });
    return out;
}

/**
 * Every `Math.abs(...) <comparison> <number literal>` in a subtree, with the
 * identifiers its subtraction reads.
 *
 * This is the shape both a shared call and a hand-rolled threshold take, so the
 * assertion below is about WHICH FIGURES one reads rather than about the shape.
 */
function absoluteThresholds(node) {
    const out = [];
    walk(node, (n) => {
        if (n.type !== "BinaryExpression") return;
        if (![">", ">=", "<", "<="].includes(n.operator)) return;
        if (n.right?.type !== "Literal" || typeof n.right.value !== "number") return;
        const absCalls = callsNamed(n.left ?? {}, "abs");
        if (absCalls.length === 0) return;
        out.push({ threshold: n.right.value, reads: namesIn(n.left) });
    });
    return out;
}

export function run({ check, assert, log }) {
    const form = parseFile(FORM);

    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — the form calls the rule and passes its own figures:");
    const calls = callsNamed(form.ast, "checkHeaderVariance");
    check("the form calls checkHeaderVariance", calls.length, 1);
    const args = calls[0]?.arguments ?? [];
    check("  with two arguments", args.length, 2);
    // Argument 1 is the typed figure, reached through a coercion, so the
    // assertion is that the coercion reads the stated-total state and nothing
    // else. Argument 2 must be the binding itself — a bare identifier — because
    // that is what ties the warning to the label the reader is comparing against.
    const statedArg = args[0] ? namesIn(args[0]) : new Set();
    assert(`  the first argument reads ${STATED}`, statedArg.has(STATED));
    assert(
        `  and not ${CALCULATED}, which is the figure it is compared against`,
        !statedArg.has(CALCULATED)
    );
    check(
        `  the second argument is ${CALCULATED} itself`,
        args[1]?.type === "Identifier" ? args[1].name : `a ${args[1]?.type}`,
        CALCULATED
    );
    // THE MUTANT, SPELLED OUT: `checkHeaderVariance(parseFloat(vendorStatedTotal),
    // itemsTotal)` satisfies "calls the rule" and every other check in this tier.
    // What rejects it is the clause above, so prove that clause can say no.
    assert(
        "  and the argument test rejects the sum without the money terms",
        !["itemsTotal", "shippingFee", "tariff", "salesTax"].includes(CALCULATED)
    );
    // ANTI-VACUITY: the walk has to be reading this form rather than an empty
    // tree, and the figure it names has to be the one the label renders.
    const formLiterals = [];
    walk(form.ast, (n) => {
        if (n.type === "JSXText") formLiterals.push(n.value ?? "");
        else if (n.type === "Literal" && typeof n.value === "string") formLiterals.push(n.value);
    });
    assert(
        "the walk read the real form — its calculated-total label is there",
        formLiterals.some((s) => s.includes("Calculated total"))
    );
    assert(`  and ${CALCULATED} is a binding in it`, namesIn(form.ast).has(CALCULATED));

    // -----------------------------------------------------------------------
    log("");
    log("THE SECOND MUTANT — a threshold of the form's own, beside the shared call:");
    const thresholds = absoluteThresholds(form.ast);
    const headerOwn = thresholds.filter(
        (t) => t.reads.has(STATED) || t.reads.has(CALCULATED)
    );
    check(
        `no hand-rolled threshold on the header's figures${
            headerOwn.length ? ` (${headerOwn.map((t) => t.threshold).join(", ")})` : ""
        }`,
        headerOwn.length,
        0
    );
    // ANTI-VACUITY, AND IT IS THE CONSTANT #254 REFUSED TO MERGE. The walk must
    // find a threshold that legitimately stays, or "none on the header's figures"
    // is just what a broken walk always says. `shippingFeeMismatch` compares a
    // typed shipping fee against the order's own — a different question, at a
    // different figure, in the same function.
    const shipping = thresholds.filter((t) => t.reads.has("shippingFee"));
    assert(
        "the threshold walk finds the shipping-fee comparison, which stays",
        shipping.length === 1
    );
    check("  at its own figure, unmerged", shipping[0]?.threshold, 0.01);

    // -----------------------------------------------------------------------
    log("");
    log("the tolerance itself — one number, derived, and no percentage term:");
    // Half a cent absorbs the representation error of summing whole-cent figures
    // and nothing else, so a genuine cent has to fire and the slop must not.
    assert("a whole cent of difference fires", checkHeaderVariance(100.01, 100));
    assert("  in both directions", checkHeaderVariance(99.99, 100));
    assert(
        "  and floating-point slop does not",
        !checkHeaderVariance(0.1 + 0.2, 0.3) && !checkHeaderVariance(100000.0000001, 100000)
    );
    // NO PERCENTAGE TERM: the giveaway is a tolerance that grows with the figure.
    // One percent of this invoice would have been $500.
    assert(
        "the tolerance does not scale with the invoice",
        checkHeaderVariance(50000.01, 50000) && checkHeaderVariance(50100, 50000)
    );
    // AND NO DOLLAR FLOOR, which is #283's counterexample: a term the app has no
    // column for is unbounded downward, so a floor hides the small end of exactly
    // the class that issue exists to surface.
    assert("a small missing charge is not swallowed", checkHeaderVariance(120, 124.8));
    // The source, so a floor cannot come back as a `Math.max` the behavior above
    // would not distinguish on these inputs.
    const varianceSource = readFileSync(repoPath("lib/variance.js"), "utf8");
    const code = varianceSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    check("no percentage term survives in the module", /TOLERANCE_PCT/.test(code), false);
    check("  and no floor is taken over the tolerance", /Math\.max/.test(code), false);
    // The two constants stay two, and the header's is the tighter one.
    assert(
        "the two comparisons are still two",
        checkUnitPriceVariance(10.005, 10) === false && checkHeaderVariance(10.005, 10) === true
    );

    // -----------------------------------------------------------------------
    log("");
    log("THE PREMISE — the write path refuses what the derivation forbids:");
    const writer = parseFile(WRITER);
    for (const fn of ["createInvoiceItem", "updateInvoiceItem"]) {
        const node = resolveFunction(writer.ast, fn);
        assert(`${fn} resolves`, node !== null);
        if (!node) continue;
        const called = namesIn(node);
        check(`  ${fn} asserts a whole quantity`, called.has("assertWholeQty"), true);
        check(`  ${fn} asserts a whole-cent price`, called.has("assertWholeCentPrice"), true);
    }
    // Both guards must actually throw rather than log, or the premise is a comment.
    // Asked as a ThrowStatement rather than as a call to `Error`, which is a
    // NewExpression and which the first version of this file looked for as a call
    // — it reported both guards as not throwing while both did.
    for (const guard of ["assertWholeQty", "assertWholeCentPrice"]) {
        const node = resolveFunction(writer.ast, guard);
        assert(`${guard} resolves`, node !== null);
        let throws = false;
        walk(node ?? {}, (n) => {
            if (n.type === "ThrowStatement") throws = true;
        });
        assert(`  and throws`, throws);
    }
    // ANTI-VACUITY: the identifier walk must be seen to say NO for a name that is
    // genuinely not called in that function — otherwise "it calls the guard" is
    // what this loop says about any name at all.
    const reader = resolveFunction(writer.ast, "getItemsByInvoice");
    assert("the call walk works on a neighbor", namesIn(reader).has("getLinkedRecords"));
    assert("  and says no to a guard that reader does not run", !namesIn(reader).has("assertWholeQty"));

    // Both predicates behave, or the guards above are asking the wrong question.
    assert("a fraction is not a whole quantity", !isWholeQty(2.5) && isWholeQty(3));
    assert("  and an absent one is not the question", isWholeQty(null) && isWholeQty(undefined));
    assert("a sub-cent price is refused", !isWholeCentPrice(1.005));
    // The slack, which is the whole reason this is not an equality test: neither of
    // these is exactly representable in binary and both are whole cents.
    assert("  while a whole cent that binary cannot hold exactly is admitted",
        isWholeCentPrice(8.11) && isWholeCentPrice(0.07) && isWholeCentPrice(480));

    // -----------------------------------------------------------------------
    log("");
    log("and the reader who typed the figure is refused before the throw:");
    // THE MUTANT: drop the action-level refusal. Everything above still passes and
    // the premise still holds — the reader just gets `Something went wrong` on an
    // input they could fix. Measured in a browser: both controls' step validation
    // does not fire on this form, so this state is reachable by typing.
    for (const [path, handler] of [
        [CREATE_ACTION, "createInvoiceAction"],
        [EDIT_ACTION, "updateInvoiceAction"],
    ]) {
        const { ast } = parseFile(path);
        const fn = resolveFunction(ast, handler);
        assert(`${handler} resolves`, fn !== null);
        if (!fn) continue;
        const names = namesIn(fn);
        check(`  ${handler} asks isWholeQty`, names.has("isWholeQty"), true);
        check(`  ${handler} asks isWholeCentPrice`, names.has("isWholeCentPrice"), true);
        check(`  ${handler} returns the reader's own words`, names.has("ITEM_PRECISION_COPY"), true);
        // ANTI-VACUITY: the walk has to be inside this handler's body rather than
        // its wrapper, which is `invoice-money-terms.mjs`'s own lesson on these two
        // exports. `shippingFee` is read in both bodies and nowhere else.
        assert(`  the walk reached ${handler}'s body`, names.has("shippingFee"));
    }
    // The two messages have to differ and name their own figure, or one refusal
    // points a reader at the wrong control.
    assert(
        "the two refusals are two",
        ITEM_PRECISION_COPY.qty !== ITEM_PRECISION_COPY.unitPrice
    );
    assert(
        "  each naming the figure it is about",
        /quantity/i.test(ITEM_PRECISION_COPY.qty) &&
            /unit price/i.test(ITEM_PRECISION_COPY.unitPrice) &&
            !/unit price/i.test(ITEM_PRECISION_COPY.qty)
    );
    // The word for an `Invoice Items` row (#303). It was `charge` here until then,
    // pinned on a `naming.md` row that had settled the noun on #274's authority
    // when #274 weighed only the verb. `item` unmodified, because neither sentence
    // names a second kind of item row.
    assert(
        "  and both say item, not charge",
        [ITEM_PRECISION_COPY.qty, ITEM_PRECISION_COPY.unitPrice].every(
            (s) => /\bitem\b/i.test(s) && !/charge/i.test(s)
        )
    );

    // -----------------------------------------------------------------------
    log("");
    log("the form's sentence is a constant, where the vocabulary check can read it:");
    const beforeSaving = VARIANCE_COPY.headerBeforeSaving("1,620.00", "1,710.00");
    assert("it states both figures", beforeSaving.includes("1,620.00") && beforeSaving.includes("1,710.00"));
    assert(
        "  and names the two controls rather than the two fields",
        /Vendor's Stated Total/.test(beforeSaving) && !/Calculated Total\b/.test(beforeSaving)
    );
    // The tense is the distinction #179 kept it out of the stored pair for: this
    // one addresses the person still typing.
    assert("  it addresses the moment before there is a record", /before submitting/.test(beforeSaving));
    assert(
        "  which the stored sentence deliberately does not",
        !/before submitting/.test(VARIANCE_COPY.headerDetail("$1.00", "$2.00"))
    );
    // `Mismatch` is the delivery axis's on these same screens (#232).
    assert("  and it does not take the delivery axis's word", !/mismatch/i.test(beforeSaving));
    // It has to be GONE from the form as element text, or the constant is a second
    // home for a sentence still typed into JSX.
    const inJsx = formLiterals.filter((s) => /doesn't match the calculated total/.test(s));
    check("the form types no copy of it", inJsx.length, 0);
    // ANTI-VACUITY for that scan, in the shape `invoice-money-terms.mjs` records:
    // the walk has to be seen reading JSX text, since that is what the old
    // sentence was.
    assert(
        "  the scan reads text written as a JSX child",
        formLiterals.some((s) => s.includes("+ Add Sales Tax"))
    );
    assert(
        "  and its matcher would catch the old sentence",
        /doesn't match the calculated total/.test(
            "Vendor's Stated Total (1.00) doesn't match the calculated total (2.00) — double-check"
        )
    );
}

if (isMain(import.meta.url)) standalone(title, run);
