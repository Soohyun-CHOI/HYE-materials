// Every optional money term reaches the total (#283).
//
// WHAT THIS FILE IS FOR IS THE SILENT MUTANT OF AN ADDITION, which is
// `no-free-text-charge.mjs` pointed the other way: that file guards the empty
// space a removal leaves, this one guards the seam an addition opens. A new
// currency term on `Invoices` has to be picked up in six places, and a term that
// reaches five of them breaks nothing. The field exists, the form accepts a
// figure, the invoice detail prints a row for it — and the total is short by
// exactly that figure, which the header variance check then reports as the
// vendor's own arithmetic error. That is the bug #283 was raised to fix,
// reintroduced by omission rather than by a wrong line of code, and every other
// check in this tier stays green through it.
//
// THE ONE MUTANT THIS TIER CANNOT SEE IS THE AIRTABLE FORMULA, and saying so is
// half the point of this header. `Invoices."Calculated Total"` is
// `SUM({Items Subtotal}, {Shipping Fee}, {Tariff}, {Sales Tax})`, it is not in
// this repository, it leaves no diff, and it can be rewritten between two green
// runs of `npm test`. It is asserted in `scripts/tests/verify-variance-15.mjs`,
// against the value the live base returns, and that is the FIRST assertion there
// for this reason. This is #18's split — `offline/unit-options.mjs` compares two
// files, `verify-unit-options-18.mjs` reads the live fields — and neither half
// subsumes the other.
//
// SO WHAT IS ASSERTED HERE IS THE HALF MADE OF SOURCE, and it is two claims:
//
//   1. THE CLIENT-SIDE TOTAL, which is the same mutant in JavaScript.
//      `InvoiceForm.js`'s `calculatedTotal` is the figure a reader compares
//      against the document in their hand before saving, and a term missing from
//      it reads low in exactly the way the formula's would. This one IS in the
//      repository, so it is asserted on the declaration by name.
//   2. THE TERMS TRAVEL TOGETHER. `Tariff` and `Sales Tax` are the same kind of
//      figure — #283's whole premise — so every site that carries one carries the
//      other. Asked as a parallel-structure question rather than as six separate
//      shapes, because that is what makes the check survive a THIRD term: add it
//      to `TERMS` and every site is asked about it at once.
//
// THE ANTI-VACUITY IS THE TARIFF SIDE, and it is load-bearing rather than
// ceremonial: "the file mentions neither term" and "the file mentions both" are
// the same answer to a badly asked question. Each site is required to carry the
// term that was already there, so a renamed file, a moved function or a
// restructured form fails here instead of quietly passing with nothing to check.

import { parseFile, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every optional money term reaches the total (#283)";

const SERVICE = "lib/airtable/invoices.js";
const CREATE_ACTION = "app/invoices/new/actions.js";
const EDIT_ACTION = "app/invoices/[invoiceId]/actions.js";
const CREATE_FORM = "app/invoices/new/InvoiceForm.js";
const EDIT_FORM = "app/invoices/[invoiceId]/edit/EditInvoiceForm.js";
const DETAIL = "app/invoices/[invoiceId]/page.js";

/**
 * The optional currency terms on `Invoices`, each in the three spellings the
 * code uses: the Airtable field, the JS property, and the form control's name.
 *
 * A THIRD TERM IS ONE ENTRY. That is the property this shape exists for — the
 * assertions below iterate it, so a fourth money field on this table cannot be
 * added to five of the six sites without failing here.
 */
const TERMS = [
    { field: "Tariff", prop: "tariff", control: "tariff", since: "#57" },
    { field: "Sales Tax", prop: "salesTax", control: "salesTax", since: "#283" },
];

/**
 * Every string a subtree can put on a screen: literals, template chunks, and JSX
 * TEXT.
 *
 * `JSXText` IS A SEPARATE NODE TYPE AND LEAVING IT OUT MADE THIS FILE'S LABEL
 * ASSERTION VACUOUS, which its own anti-vacuity clause caught on the first run.
 * Both the old label and the new one are element CHILDREN — `Calculated total:`
 * followed by an expression — so neither is a `Literal` and a walk without this
 * branch reported the retired term list as absent from a file that had been
 * carrying it all along. `no-free-text-charge.mjs` records the same hole, found
 * the same way; the lesson is worth having twice.
 */
function literalsIn(node) {
    const out = [];
    walk(node, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        else if (n.type === "TemplateElement") out.push(n.value.cooked ?? "");
        else if (n.type === "JSXText") out.push(n.value ?? "");
    });
    return out;
}

/** Every identifier and JSX identifier name in a subtree. */
function namesIn(node) {
    const out = new Set();
    walk(node, (n) => {
        if (n.type === "Identifier" || n.type === "JSXIdentifier") out.add(n.name);
    });
    return out;
}

/**
 * Does this function WRITE the named Airtable field — an object property whose
 * key is that string?
 *
 * Asked as a property key rather than as "the file contains the string", which
 * is the difference between a value that lands on the record and one that only
 * appears in a comment. This is mutant 2 exactly: a parameter destructured and
 * then never written is invisible to every other check, and to `next build`.
 */
function writesField(fnNode, fieldName) {
    let found = false;
    walk(fnNode, (n) => {
        if (found || n.type !== "Property") return;
        const key = n.key;
        const name = key?.type === "Literal" ? key.value : key?.name;
        if (name === fieldName) found = true;
    });
    if (found) return true;
    // `fields["Sales Tax"] = value` — the update path's shape, an assignment to a
    // computed member rather than a property in a literal.
    walk(fnNode, (n) => {
        if (found || n.type !== "AssignmentExpression") return;
        const t = n.left;
        if (t?.type !== "MemberExpression" || !t.computed) return;
        if (t.property?.type === "Literal" && t.property.value === fieldName) found = true;
    });
    return found;
}

/** The `init` of a top-level-or-nested `const NAME = …`, as JSON. */
function declaratorInit(ast, name) {
    let init = null;
    walk(ast, (n) => {
        if (init || n.type !== "VariableDeclarator") return;
        if (n.id?.name === name) init = n.init;
    });
    return init;
}

export function run({ check, assert, log }) {
    // ── 1. the client-side total, which is this issue's own bug in JS ────────
    log("THE QUIET MUTANT this tier CAN see — a term that misses the preview total:");
    const form = parseFile(CREATE_FORM);
    const total = declaratorInit(form.ast, "calculatedTotal");
    assert("InvoiceForm.js declares calculatedTotal", total !== null);
    const totalNames = total ? namesIn(total) : new Set();
    for (const term of TERMS) {
        check(
            `  it adds ${term.field} (${term.since})`,
            totalNames.has(term.prop) || totalNames.has(`${term.prop}Enabled`),
            true
        );
    }
    // ANTI-VACUITY: the walk has to be reading the sum rather than an empty node,
    // and it must be seen to say NO for something that is genuinely not a term of
    // it. `vendorStatedTotal` is the figure this total is COMPARED against and is
    // the one value that must never be inside it.
    assert("the sum walk read the real expression", totalNames.has("itemsTotal"));
    assert(
        "  and says no to the figure the total is compared against",
        !totalNames.has("vendorStatedTotal")
    );

    // ── 2. the service layer writes each term ───────────────────────────────
    log("");
    log("the service layer writes every term rather than destructuring and dropping it:");
    const service = parseFile(SERVICE);
    for (const name of ["createInvoice", "updateInvoice"]) {
        const fn = resolveFunction(service.ast, name);
        assert(`${name} resolves`, fn !== null);
        if (!fn) continue;
        const params = namesIn(fn.params ?? []);
        for (const term of TERMS) {
            // Both halves, because either one alone is the mutant: a parameter
            // with no write is a value silently discarded, and a write with no
            // parameter cannot compile.
            check(`  ${name} takes ${term.prop}`, params.has(term.prop), true);
            check(`  ${name} writes "${term.field}"`, writesField(fn, term.field), true);
        }
    }
    // ANTI-VACUITY: `writesField` must be seen to say no. `setInvoiceDelivery` is a
    // writer in the same module that legitimately writes one field and not these.
    const linker = resolveFunction(service.ast, "setInvoiceDelivery");
    assert("the field-write matcher works on a neighbor", writesField(linker, "Delivery"));
    assert("  and says no to a field that writer does not touch", !writesField(linker, "Sales Tax"));

    // ── 3. and reads it back ────────────────────────────────────────────────
    log("");
    log("and reads every term back, or the screens have nothing to render:");
    const reader = resolveFunction(service.ast, "recordToInvoice");
    assert("recordToInvoice resolves", reader !== null);
    const read = reader ? literalsIn(reader) : [];
    for (const term of TERMS) {
        check(`  recordToInvoice reads "${term.field}"`, read.includes(term.field), true);
    }
    assert("the reader walk saw the record's other fields", read.includes("Amount Due"));

    // ── 4. both actions carry every term from the form to the writer ────────
    log("");
    log("both write actions carry every term from the form to the service layer:");
    for (const [path, handler] of [
        [CREATE_ACTION, "createInvoiceAction"],
        [EDIT_ACTION, "updateInvoiceAction"],
    ]) {
        const { ast } = parseFile(path);
        const fn = resolveFunction(ast, handler);
        assert(`${handler} resolves`, fn !== null);
        if (!fn) continue;
        const literals = literalsIn(fn);
        const names = namesIn(fn);
        for (const term of TERMS) {
            check(`  ${handler} reads "${term.control}" off the form`, literals.includes(term.control), true);
            check(`  ${handler} passes ${term.prop} on`, names.has(term.prop), true);
        }
        // ANTI-VACUITY: the literal walk has to be inside the handler's own body,
        // which the wrapper would otherwise hide (#147's shape).
        assert(`  the walk reached ${handler}'s body`, literals.includes("shippingFee"));
    }

    // ── 5. every screen offers or shows every term ──────────────────────────
    log("");
    log("every screen that shows one term shows the other:");
    for (const [path, label] of [
        [CREATE_FORM, "the create form"],
        [EDIT_FORM, "the edit form"],
        [DETAIL, "the invoice detail"],
    ]) {
        const { ast } = parseFile(path);
        const literals = literalsIn(ast);
        const names = namesIn(ast);
        for (const term of TERMS) {
            // A control name on a form, a property on the detail: either spelling
            // is the term being present on that screen.
            const present = literals.includes(term.control) || names.has(term.prop);
            check(`  ${label} carries ${term.field}`, present, true);
        }
    }
    // ANTI-VACUITY for the detail specifically, which is the one of the three that
    // renders rather than accepts: its row must be CONDITIONAL, since an
    // unconditional row would print "$0.00" on every invoice that states no tax —
    // the assertion the screen exists to avoid making.
    const detail = parseFile(DETAIL);
    const rows = declaratorInit(detail.ast, "summaryRows");
    assert("the detail declares summaryRows", rows !== null);
    let conditional = 0;
    walk(rows ?? {}, (n) => {
        if (n.type !== "BinaryExpression" || n.operator !== "!=") return;
        if (n.right?.type !== "Literal" || n.right.value !== null) return;
        const left = n.left?.property?.name;
        if (TERMS.some((t) => t.prop === left)) conditional += 1;
    });
    check("  each optional term's row is conditional on it", conditional, TERMS.length);
    // And the two rows that are NOT optional are still there, or the check above
    // would pass on a footer that had lost them.
    assert(
        "  while the unconditional rows are unchanged",
        literalsIn(rows ?? {}).includes("Items Subtotal") &&
            literalsIn(rows ?? {}).includes("Shipping Fee") &&
            literalsIn(rows ?? {}).includes("Calculated Total")
    );

    // ── 6. the label states no term list ────────────────────────────────────
    log("");
    log("the preview total's label names the figure, not its terms (#283):");
    // WHY THIS IS AN ASSERTION AND NOT A PREFERENCE: the label was a term list,
    // and a term list with optional members is either wrong or grows a word per
    // term. Re-adding one is how the label comes back to disagreeing with the sum
    // beside it, and the words are written straight into JSX where the vocabulary
    // checks cannot read them.
    const formLiterals = literalsIn(form.ast);
    const listy = formLiterals.filter((s) => /Items \+ Shipping/.test(s));
    check(`term-list spellings of the label${listy.length ? ` (${listy.join(" | ")})` : ""}`, listy.length, 0);
    assert(
        "  and the label itself is still on the screen",
        formLiterals.some((s) => s.includes("Calculated total"))
    );
    // ANTI-VACUITY, IN THE ONE SHAPE THAT MATTERS HERE: the label is a JSX CHILD,
    // so the walk has to be seen reading element text rather than string literals
    // — without that clause the ban above passes on a form that still carries the
    // list, which is what the first run of this file actually did.
    assert(
        "  the walk reads text written as a JSX child, which is what the label is",
        formLiterals.some((s) => s.includes("+ Add Sales Tax"))
    );
    // And the matcher must be able to find the string it is banning.
    assert(
        "  the ban matcher would catch the old label",
        /Items \+ Shipping/.test("Calculated total (Items + Shipping + Tariff):")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
