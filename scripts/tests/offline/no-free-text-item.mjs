// Every invoice item names an ordered item (#278) — the writers, not the judgment.
//
// WHAT THIS FILE IS FOR IS THE SILENT MUTANT OF A REMOVAL. #278 deleted twenty-six
// branches, six pieces of copy and a tone; deleting them leaves EMPTY SPACE, and
// nothing guards empty space. The next person to want a freight line on an invoice
// adds an `<option value="">` back, or drops the refusal from
// `createInvoiceAction`, and every other check in this tier stays green — the
// judgment branches are gone, so there is nothing left to fail. `npm test` would
// report a clean run over an app that had quietly reacquired the state.
//
// SO THE ASSERTIONS ARE ON THE WRITERS RATHER THAN ON WHAT WAS REMOVED. Whether a
// verdict exists is a fact about copy and moves whenever copy moves; whether the
// action refuses an item with no `poItemRecordId` is the thing that makes the state
// unwritable, and it is one AST question with one answer. Two writers exist and both
// are checked:
//
//   1. `createInvoiceAction` refuses before it writes. This is the one a reader
//      meets, and it is the boundary — the form's amber sentence explains, but a
//      Server Action is reachable directly (CLAUDE.md's re-authorization rule
//      applies to validity as much as to permission).
//   2. `createInvoiceItem` throws. The last line of defence, and the one that
//      catches a caller inside `lib/` — `lib/overagePR.js` is the other one, and a
//      future third would fail here rather than write a null link.
//
// THE FLAG IS CHECKED AS AN ABSENCE, WHICH IS WEAKER AND IS SAID SO. A constant that
// is gone is gone; a constant reintroduced under another name is not caught by
// looking for the old one. What makes that acceptable is that the flag was never the
// gate — it hid one `<option>` — so the two refusals above are what a re-added flag
// would have to get past, and they are checked by shape rather than by name.
//
// AND THE FORM STILL EXPLAINS ITSELF, which is the half a refusal cannot cover. #91
// leaves a row on an exhausted purchase order nothing to pick, and the sentence
// naming that is written straight into JSX where no offline check can read its
// wording. What IS checkable is that the branch exists and is reached from the same
// emptiness the refusal keys on, so a form that silently offers a dead row fails
// here even though its words do not.
//
// SCOPE: three files, named rather than swept. A sweep would ask "does any file
// mention a free-text item", which is a question about comments.
//
// THE FILE WAS `no-free-text-charge.mjs` UNTIL #303, which made an `Invoice Items`
// row an `invoice item`. A name is the same drift one level up (`naming.md`), and
// this one had the noun in the subject position of its own title sentence.

import { callsTo, parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Every invoice item names an ordered item — the writers (#278)";

const ACTION = "app/invoices/new/actions.js";
const WRITER = "lib/airtable/invoiceItems.js";
const FORM = "app/invoices/new/InvoiceForm.js";

/** Every identifier name in one file, so an absence is an absence in CODE. */
function identifiersIn(relPath) {
    const names = new Set();
    const { ast } = parseFile(relPath);
    walk(ast, (node) => {
        if (node.type === "Identifier" || node.type === "JSXIdentifier") names.add(node.name);
    });
    return names;
}

/**
 * Every string this file can put on a screen or in an error: string literals,
 * template chunks, and JSX TEXT.
 *
 * `JSXText` IS A SEPARATE NODE TYPE AND LEAVING IT OUT WAS A REAL HOLE, found by
 * running the mutant rather than by reading. The first version of this function
 * walked `Literal` and `TemplateElement` only; re-adding
 * `<option value="">Other (free text)</option>` to the form put the words back on a
 * screen as an element CHILD, which is `JSXText` and neither of those, and the file
 * passed 14 of 14. Comments are still invisible, which is correct — this file's own
 * notes name the removed option and must not fail on saying so.
 */
function literalsIn(relPath) {
    const out = [];
    const { ast } = parseFile(relPath);
    walk(ast, (node) => {
        if (node.type === "Literal" && typeof node.value === "string") out.push(node.value);
        else if (node.type === "TemplateElement") out.push(node.value.cooked ?? "");
        else if (node.type === "JSXText") out.push(node.value ?? "");
    });
    return out;
}

/**
 * Does this file refuse on a falsy `poItemRecordId` — an `if` whose test reads that
 * name under a `!`, containing a `return` or a `throw`?
 *
 * ASKED ON THE SHAPE RATHER THAN ON THE WORDING, because the message is copy and
 * will be reworded. What it cannot see is order: a refusal after the write would
 * satisfy this, which is the standing limit of every structural check in this tier
 * (`_ast.mjs` says so) and is why the credentialed tier exists.
 */
function refusesOnMissingOrderedItem(relPath) {
    const { ast } = parseFile(relPath);
    let found = false;
    walk(ast, (node) => {
        if (node.type !== "IfStatement" || found) return;
        const test = JSON.stringify(node.test);
        if (!/"UnaryExpression"/.test(test) || !/poItemRecordId/.test(test)) return;
        const body = JSON.stringify(node.consequent);
        if (/"ReturnStatement"|"ThrowStatement"/.test(body)) found = true;
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── the two writers ─────────────────────────────────────────────────────
    log("both writers refuse an invoice item with no ordered item:");
    check(`${ACTION} refuses before writing`, refusesOnMissingOrderedItem(ACTION), true);
    check(`${WRITER} throws rather than coercing`, refusesOnMissingOrderedItem(WRITER), true);

    // ANTI-VACUITY, and it needs both halves: the matcher has to be seen to say NO,
    // or "true" is what it returns for every file. `lib/invoiceItemFold.js` is a
    // module in the same area that legitimately has no such refusal.
    check(
        "the matcher says no where there is no refusal",
        refusesOnMissingOrderedItem("lib/invoiceItemFold.js"),
        false
    );
    // And it must be reading the shape rather than the name: a file that MENTIONS
    // `poItemRecordId` without refusing on it must still come back false.
    assert(
        "  even in a file that names the field",
        identifiersIn("lib/invoiceOrderBreakdown.js").has("items") &&
            refusesOnMissingOrderedItem("lib/invoiceOrderBreakdown.js") === false
    );

    // ── the writer's error names the issue ──────────────────────────────────
    // Not the wording, which is free: the ISSUE NUMBER, so whoever hits the throw
    // can find the argument. This is the one string assertion here and it is on a
    // developer-facing message rather than on screen copy.
    log("");
    log("the throw points at the decision behind it:");
    assert(
        "the writer's message cites #278",
        literalsIn(WRITER).some((s) => /#278/.test(s) && /PO Item/.test(s))
    );

    // ── the flag is gone ────────────────────────────────────────────────────
    log("");
    log("the flag and its option are gone from the form:");
    const formIdentifiers = identifiersIn(FORM);
    check("no SHOW_OTHER_ITEM_OPTION identifier", formIdentifiers.has("SHOW_OTHER_ITEM_OPTION"), false);
    assert(
        "  and no `Other (free text)` option text",
        !literalsIn(FORM).some((s) => /Other \(free text\)/.test(s))
    );
    // ANTI-VACUITY for both: the walks have to be reading this file at all.
    assert(
        "the identifier walk reached the form",
        formIdentifiers.has("EMPTY_ITEM") && formIdentifiers.size > 100
    );
    assert(
        "  and the literal walk did too",
        literalsIn(FORM).some((s) => s.includes("Manual Entry"))
    );
    // ANTI-VACUITY FOR THE JSX HALF SPECIFICALLY, because that is the half the first
    // version of this file did not have: the walk must be seen to read text that is
    // an element's CHILD rather than an attribute or a string.
    assert(
        "  including text written as a JSX child, which is where the option lived",
        literalsIn(FORM).some((s) => s.includes("Add another PO"))
    );

    // ── the form explains the one emptiness #91 can produce ─────────────────
    log("");
    log("a row with nothing left to pick says so rather than offering a box:");
    // The branch is named rather than its wording checked, for the reason in the
    // header: the sentence is JSX and this tier cannot read rendered text. What it
    // can hold is that the form COMPUTES the condition and that the condition is the
    // same emptiness the select is built from.
    assert("the form names the state", formIdentifiers.has("noOrderedItemLeft"));
    assert(
        "  and derives it from the option list the select renders",
        formIdentifiers.has("availablePoItemOptions")
    );
    const formSource = parseFile(FORM);
    let derivedFromOptions = false;
    walk(formSource.ast, (node) => {
        if (node.type !== "VariableDeclarator") return;
        if (node.id?.name !== "noOrderedItemLeft") return;
        derivedFromOptions = /availablePoItemOptions/.test(JSON.stringify(node.init));
    });
    check("  in its own declaration, not somewhere else", derivedFromOptions, true);

    // ── nothing calls the removed predicate ─────────────────────────────────
    // `countsTowardStatus` was the judgment's entry point and its absence is asserted
    // in `offline/delivery-status.mjs` on the module object. Here the question is the
    // other direction: no file still CALLS it, which a stale import would otherwise
    // turn into a load-time failure rather than a named one.
    log("");
    log("nothing calls the judgment that was removed:");
    const callers = [];
    for (const relPath of [ACTION, WRITER, FORM, "lib/deliveryReconciliation.js", "lib/invoiceDeliveryEntries.js"]) {
        const { ast } = parseFile(relPath);
        if (callsTo(ast, "countsTowardStatus").length > 0) callers.push(relPath);
    }
    check(
        `files still calling countsTowardStatus${callers.length ? ` (${callers.join(", ")})` : ""}`,
        callers.length,
        0
    );
    // ANTI-VACUITY: `callsTo` has to be able to find a call in one of those files.
    assert(
        "the call matcher works on a function those files really do call",
        callsTo(parseFile("lib/deliveryReconciliation.js").ast, "invoiceShareStatus").length > 0
    );
}

if (isMain(import.meta.url)) standalone(title, run);
