// Every path that writes one of these figures holds it to the cent (#308).
//
// WHAT THIS FILE IS FOR. #254 derived a half-cent tolerance for the invoice header
// from a premise — a whole quantity at a whole-cent price is exact to the cent — and
// enforced that premise on the invoice write path alone, on the ground that the guard
// sits downstream of every copy. It does. What it could not stop is a figure being
// accepted on a REQUEST, frozen into `PO Items` at approval, printed on the PDF the
// office sends the vendor, and refused only when somebody enters the invoice for it:
// an order that becomes uninvoiceable through the app after it has been placed.
//
// SO THE RULE IS THE SAME AND THE COVERAGE IS THE ISSUE, which is what this file
// pins. `offline/invoice-header-tolerance.mjs` still owns the tolerance, its
// derivation and the two predicates' behavior; what lives here is WHO ASKS, over
// three layers:
//
//   THE ACTIONS, with words. Three request actions plus the two invoice ones. A
//   person can type `2.5` into a quantity box on either form and press the button —
//   #254 measured that on the invoice form and #308 measured it again on this one —
//   so a bare service throw reaches them as `Something went wrong`, on an input they
//   could have fixed.
//
//   THE SERVICE WRITERS, with a throw. Six of them now, across five modules, which is
//   why the two guards moved to `lib/variance.js` in #308: four copies of one throw is
//   the duplication CLAUDE.md's own section forbids.
//
//   THE FREEZE, with the same throw and a reader who cannot see the figure. Unreachable
//   through this app once the request is guarded — which is the point, because the one
//   path that still reaches it is a hand edit in the Airtable UI, and the freeze is the
//   last door before the number is multiplied into a stored `Amount` and printed for a
//   vendor. `generatePOAction` is what turns that throw into a sentence.
//
// WHAT A PASS DOES NOT PROVE. That any of it renders, or that a refusal leaves the
// typed value in the form — both are browser facts, and the write half is
// `verify-item-precision-308.mjs`'s. This tier reads source and judges pure functions.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import {
    ITEM_PRECISION_COPY,
    PRECISION_BLOCKED,
    PRECISION_BLOCKED_COPY,
    SHIPPING_FEE_PRECISION_COPY,
    assertWholeCentPrice,
    assertWholeQty,
    isWholeCentPrice,
    isWholeQty,
} from "../../../lib/variance.js";
import { parseFile, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every path that writes one of these figures holds it to the cent (#308)";

/** Every identifier name in a subtree. */
function namesIn(node) {
    const out = new Set();
    walk(node ?? {}, (n) => {
        if (n.type === "Identifier" || n.type === "JSXIdentifier") out.add(n.name);
    });
    return out;
}

/**
 * The service writers, and which half of the rule each owes.
 *
 * `PR Items` AND `PO Items` OWE BOTH; the two header tables owe only the cent half,
 * because a shipping fee is summed beside the item amounts and multiplied by nothing —
 * there is no quantity for `assertWholeQty` to be about.
 */
const WRITERS = [
    ["lib/airtable/prItems.js", "createItem", true],
    ["lib/airtable/prItems.js", "updateItem", true],
    ["lib/airtable/poItems.js", "createPOItem", true],
    ["lib/airtable/invoiceItems.js", "createInvoiceItem", true],
    ["lib/airtable/invoiceItems.js", "updateInvoiceItem", true],
    ["lib/airtable/purchaseRequests.js", "createPR", false],
    ["lib/airtable/purchaseRequests.js", "updatePR", false],
    ["lib/airtable/purchaseOrders.js", "createPO", false],
];

/**
 * The actions that refuse with words, and the copy each owes.
 *
 * `saveDraftAction` IS ON THIS LIST AND THAT IS THE DECISION #308 MADE. #72 lets a
 * Draft be half-finished, and a fraction is not an unfinished state — it is a wrong
 * value, and leaving the Draft out would let somebody type `2.5`, save, and meet the
 * service throw as `Couldn't save the draft. Please try again.` a screen later.
 */
const ACTIONS = [
    ["app/prs/new/actions.js", "saveDraftAction", true, true],
    ["app/prs/new/actions.js", "createPRAction", true, true],
    ["app/prs/[prId]/actions.js", "editAndContinueAction", true, true],
    ["app/invoices/new/actions.js", "createInvoiceAction", true, false],
    ["app/invoices/[invoiceId]/actions.js", "updateInvoiceAction", true, false],
];

export function run({ check, assert, log }) {
    // ── 1: the guards, which moved and must still throw ─────────────────────
    log("the two guards live beside the predicates they wrap, and throw (#308):");
    const variance = parseFile("lib/variance.js");
    for (const guard of ["assertWholeQty", "assertWholeCentPrice"]) {
        const node = resolveFunction(variance.ast, guard);
        assert(`${guard} resolves in lib/variance.js`, node !== null);
        let throws = false;
        walk(node ?? {}, (n) => {
            if (n.type === "ThrowStatement") throws = true;
        });
        assert("  and throws", throws);
    }
    // THEY MOVED IN #308 AND THE MOVE IS THE ASSERTION. Four copies of one throw is
    // what a private helper would have become the moment the request needed it.
    const invoiceWriter = parseFile("lib/airtable/invoiceItems.js");
    for (const guard of ["assertWholeQty", "assertWholeCentPrice"]) {
        assert(
            `  and no private copy is left in lib/airtable/invoiceItems.js`,
            resolveFunction(invoiceWriter.ast, guard) === null
        );
    }
    // Run rather than read: a guard that returns instead of throwing passes section 2.
    for (const [label, call] of [
        ["a fractional quantity", () => assertWholeQty("t", 2.5)],
        ["a sub-cent price", () => assertWholeCentPrice("t", 1.005)],
        ["a sub-cent shipping fee", () => assertWholeCentPrice("t", 1.005, "Shipping Fee")],
    ]) {
        let thrown = null;
        try {
            call();
        } catch (err) {
            thrown = err;
        }
        assert(`${label} throws`, thrown !== null);
        check(`  carrying the code the retry matches on`, thrown?.code, PRECISION_BLOCKED);
        assert(`  and naming the caller`, /^t: /.test(thrown?.message ?? ""));
    }
    // And they abstain on an absent figure, which is what lets a Draft row with an
    // empty quantity save and a partial update not touch a field it is not writing.
    for (const [label, call] of [
        ["an absent quantity", () => assertWholeQty("t", undefined)],
        ["a null quantity", () => assertWholeQty("t", null)],
        ["an absent shipping fee", () => assertWholeCentPrice("t", undefined, "Shipping Fee")],
    ]) {
        let threw = false;
        try {
            call();
        } catch {
            threw = true;
        }
        assert(`${label} is not this question`, !threw);
    }
    // The field name reaches the message, or a shipping-fee refusal in a log reads as
    // a unit price.
    let feeErr = null;
    try {
        assertWholeCentPrice("createPO", 1.005, "Shipping Fee");
    } catch (err) {
        feeErr = err;
    }
    assert("a fee refusal names its own field", /Shipping Fee/.test(feeErr?.message ?? ""));
    assert("  and not the default one", !/Unit Price/.test(feeErr?.message ?? ""));

    // ── 2: every writer asks ────────────────────────────────────────────────
    log("");
    log("every service writer of one of these figures runs the guard:");
    for (const [path, fn, bothHalves] of WRITERS) {
        const node = resolveFunction(parseFile(path).ast, fn);
        assert(`${fn} resolves in ${path}`, node !== null);
        if (!node) continue;
        const called = namesIn(node);
        check(`  ${fn} asserts a whole-cent figure`, called.has("assertWholeCentPrice"), true);
        check(
            `  ${fn} ${bothHalves ? "asserts" : "does not assert"} a whole quantity`,
            called.has("assertWholeQty"),
            bothHalves
        );
    }
    // ANTI-VACUITY: the identifier walk has to be seen saying NO inside a neighbor
    // that genuinely does not guard, or "it calls the guard" is what this says about
    // any name at all.
    const reader = resolveFunction(parseFile("lib/airtable/prItems.js").ast, "getItemsByPR");
    assert("the call walk works on a neighbor", namesIn(reader).has("getLinkedRecords"));
    assert("  and says no to a guard that reader does not run", !namesIn(reader).has("assertWholeQty"));

    // ── 3: every action refuses with words first ────────────────────────────
    log("");
    log("and every action that takes one of these figures refuses with the reader's words:");
    for (const [path, fn, items, fee] of ACTIONS) {
        const node = resolveFunction(parseFile(path).ast, fn);
        assert(`${fn} resolves in ${path}`, node !== null);
        if (!node) continue;
        const called = namesIn(node);
        if (items) {
            check(`  ${fn} asks isWholeQty`, called.has("isWholeQty"), true);
            check(`  ${fn} returns the item words`, called.has("ITEM_PRECISION_COPY"), true);
        }
        check(`  ${fn} asks isWholeCentPrice`, called.has("isWholeCentPrice"), true);
        check(
            `  ${fn} ${fee ? "returns" : "does not return"} the fee's own words`,
            called.has("SHIPPING_FEE_PRECISION_COPY"),
            fee
        );
        // THE PRE-EXISTING REFUSAL SURVIVES ON THE THREE REQUEST PATHS. `Shipping Fee
        // must be a number.` answers whether a figure was typed at all; the new one
        // answers where it lands. An empty box and `1.005` are two mistakes.
        if (fee) {
            assert(`  and still asks whether it is a number`, called.has("Number"));
        }
    }

    // ── 4: the three sentences ──────────────────────────────────────────────
    log("");
    log("three sentences, because they have three subjects and three readers:");
    const all = [ITEM_PRECISION_COPY.qty, ITEM_PRECISION_COPY.unitPrice, SHIPPING_FEE_PRECISION_COPY];
    check("no two of them are one string", new Set(all).size, all.length);
    check(
        "the fee's sentence names the fee",
        /^Shipping Fee /.test(SHIPPING_FEE_PRECISION_COPY),
        true
    );
    // THE SUBJECT IS WHY IT IS A THIRD STRING AND NOT `ITEM_PRECISION_COPY.unitPrice`
    // REUSED. A shipping fee is not an item and has no unit price; #330 is the
    // precedent and this is its test applied.
    assert("  and says nothing about an item", !/\bitem\b/i.test(SHIPPING_FEE_PRECISION_COPY));
    assert("  nor about a unit price", !/unit price/i.test(SHIPPING_FEE_PRECISION_COPY));
    // One judgment, so one grammar: all three are `isWholeCentPrice` or `isWholeQty`
    // speaking, and a sentence that changed mood would read as a different kind of rule.
    for (const sentence of all) {
        assert(`\`${sentence}\` is a sentence in the family's mood`, /has to be .*\.$/.test(sentence));
    }
    check(
        "the fee asks the cent half and never a quantity",
        /whole number of cents/.test(SHIPPING_FEE_PRECISION_COPY) &&
            !/whole number\.$/.test(SHIPPING_FEE_PRECISION_COPY),
        true
    );

    // ── 5: the freeze's reader gets a sentence, not `try again` ─────────────
    log("");
    log("and the retry names this refusal, because pressing it again never helps:");
    const retry = resolveFunction(parseFile("app/prs/[prId]/actions.js").ast, "generatePOHandler");
    assert("generatePOHandler resolves", retry !== null);
    const retryNames = namesIn(retry);
    check("  it matches on the code", retryNames.has(PRECISION_BLOCKED ? "PRECISION_BLOCKED" : ""), true);
    check("  and returns the freeze's own sentence", retryNames.has("PRECISION_BLOCKED_COPY"), true);
    // THE SENTENCE HAS TO SAY WHERE TO GO. Its reader is an Admin pressing a strip's
    // button for a request somebody else filled in, whose items are past editing in
    // this app — so a remedy that names nothing is the `Please try again.` it replaces.
    assert(
        "the sentence names a remedy outside this app",
        /Airtable/.test(PRECISION_BLOCKED_COPY)
    );
    assert(
        "  and does not tell the reader to try again",
        !/try again\b/i.test(PRECISION_BLOCKED_COPY)
    );
    assert(
        "  and covers both halves of the rule, since it does not know which fired",
        /whole number/.test(PRECISION_BLOCKED_COPY) && /cents/.test(PRECISION_BLOCKED_COPY)
    );

    // ── 6: the predicates still answer what the guards ask ──────────────────
    log("");
    log("anti-vacuity — the predicates behave, or every assertion above is about nothing:");
    assert("a fraction is not a whole quantity", !isWholeQty(2.5) && isWholeQty(3));
    assert("a sub-cent price is refused", !isWholeCentPrice(1.005));
    // The slack matters and is the reason the test is not `x * 100 === Math.round(x * 100)`:
    // 8.11 is not exactly representable and the rule is meant to admit it.
    assert("  while a real whole-cent price is admitted", isWholeCentPrice(8.11) && isWholeCentPrice(0.07));
    // A string is not a number, which is why every action parses before it asks — and
    // why `isWholeQty("3")` being false is a property worth pinning rather than a trap
    // to rediscover.
    assert("a numeric string is not a whole quantity", !isWholeQty("3"));
}

if (isMain(import.meta.url)) standalone(title, run);
