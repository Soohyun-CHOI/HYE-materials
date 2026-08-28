// One payment judgment, two screens — and the invoice level gathered from the gated
// set (#311). Source shape, on the AST.
//
// WHAT THIS FILE IS FOR, IN ONE SENTENCE: `/pos` says an order's invoices are paid
// and `/pos/[poId]` lists those invoices with a badge each, so if the two computed
// that from different rules a reader could meet `Paid` on a row, open it, and find an
// unpaid invoice underneath — two answers to one question, each right on its own
// screen, and nothing failing anywhere. That is the quiet mutant, and it is quiet
// because both halves keep working.
//
//   1  ONE JUDGMENT. Both screens call `summarizePOPaymentStatus` and
//      `describePOPaymentColumn`. A rule written into either page is a second answer,
//      and the truth table in `offline/delivery-status.mjs` would keep passing over a
//      function one of them no longer uses.
//   2  NEITHER PAGE OWNS THE LATENESS RULE. `dueDate` is compared in exactly one
//      place. A page that re-derived it could disagree about the boundary — or about
//      whether a paid invoice can be late — while calling the shared summary for
//      everything else, which is the same divergence wearing a smaller coat.
//   3  BOTH SLOTS ARE RENDERED. `describePOPaymentColumn` returns `{ chip, overdue }`
//      as named slots precisely so a call site cannot show the first and drop the
//      second; that only holds if something checks that neither does.
//   4  THE INVOICE LEVEL IS GATHERED FROM THE GATED SET. `/pos` filters its rows
//      through `canViewPR` into `visible`, and the ordered items come from THAT
//      rather than from `pos` (#169's line). The invoice level inherits the gate by
//      hanging off those ordered items. Widen the first gather and all three levels
//      leak — the rows on screen do not change, so nothing looks wrong, and an
//      invoice charging two orders can pull a document nobody may see into the fold.
//
// WHY THE PAGE READING NO PAYMENT FIELD IS NOT ASSERTED HERE. `app/pos/page.js` hands
// invoice records to the judgment whole and never names `paid`, which is what keeps
// the aggregate out of it — and `offline/invoice-visibility.mjs`'s `PAID_READERS`
// inventory already holds that: the file is absent from the list, and an unregistered
// reader of `.paid` fails there. Restating it would be a second answer to the
// question that file exists to answer.
//
// WHAT A PASS DOES NOT PROVE. That the two screens AGREE on a given order. Source
// shape is not execution; what it establishes is that there is only one rule to
// disagree with. The agreement itself is read in a browser against a base carrying
// every state, and that measurement is recorded in the pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One payment judgment, two screens (#311)";

/** The page that builds each row's cell, and the page a reader lands on from it. */
const LIST = "app/pos/page.js";
const DETAIL = "app/pos/[poId]/page.js";
/** Where the list's rows are rendered — a Client Component, so the JSX is not on the page. */
const LIST_CLIENT = "app/pos/POListClient.js";

const JUDGMENT = ["summarizePOPaymentStatus", "describePOPaymentColumn"];

export function run({ check, assert, log }) {
    // ── 1: one judgment, called by both screens ─────────────────────────────
    log("both screens fold the payment axis with the same two functions:");
    for (const relPath of [LIST, DETAIL]) {
        const called = callsNamed(parseFile(relPath).ast);
        for (const name of JUDGMENT) {
            assert(`${relPath} calls ${name}`, called.has(name));
        }
    }
    // ANTI-VACUITY: the call finder has to be seen missing a name that is not there,
    // or "both call it" is what a blind walk reports.
    assert(
        "the call finder reports nothing for a function neither page calls",
        !callsNamed(parseFile(LIST).ast).has("summarizeNothingAtAll")
    );

    // ── 2: neither page owns the lateness rule ──────────────────────────────
    log("");
    log("the due date is compared in one place, and it is not a page:");
    for (const relPath of [LIST, DETAIL, LIST_CLIENT]) {
        const parsed = parseFile(relPath);
        let names = false;
        walk(parsed.ast, (node) => {
            if (node.type === "Identifier" && node.name === "dueDate") names = true;
            if (node.type === "MemberExpression" && node.property?.name === "dueDate") names = true;
            if (node.type === "Literal" && node.value === "Due Date") names = true;
        });
        assert(`${relPath} names no due date`, !names);
    }
    // ANTI-VACUITY: the same walk has to find one where there is one. The invoice list
    // renders `Due Date` as a column, so it is the control.
    let control = false;
    walk(parseFile("app/invoices/page.js").ast, (node) => {
        if (node.type === "MemberExpression" && node.property?.name === "dueDate") control = true;
    });
    assert("  and the walk finds a due date on a page that has one", control);

    // ── 3: both slots rendered, on both screens ─────────────────────────────
    log("");
    log("neither screen renders the chip and drops the badge:");
    for (const relPath of [DETAIL, LIST_CLIENT]) {
        const parsed = parseFile(relPath);
        assert(`${relPath} renders the chip slot`, readsSlot(parsed.ast, "chip"));
        assert(`  and the overdue slot`, readsSlot(parsed.ast, "overdue"));
    }
    // ANTI-VACUITY, both directions: a slot name nothing reads must come back false on
    // the same files.
    assert(
        "a slot neither screen has is not reported",
        !readsSlot(parseFile(DETAIL).ast, "noSuchSlot") &&
            !readsSlot(parseFile(LIST_CLIENT).ast, "noSuchSlot")
    );

    // ── 4: the invoice level hangs off the gated set ────────────────────────
    log("");
    log("the invoice level is gathered from the gated rows, never from every order:");
    const list = parseFile(LIST);
    // The first gather is #169's and is a declarator; the second is #311's and sits
    // inline in the reader's argument. Both are read the same way — which identifiers
    // the subtree mentions — so widening either shows up as `pos` appearing.
    const orderedItemIds = declaratorInit(list.ast, "poItemRecordIds");
    assert("the ordered-item ids are declared at all", Boolean(orderedItemIds));
    assert("  and they come from `visible`", mentions(orderedItemIds, "visible"));
    check("  and not from `pos`", mentions(orderedItemIds, "pos"), false);

    const invoiceItemArg = callArgument(list.ast, "getInvoiceItemsByRecordIds");
    assert("the invoice-item ids are passed inline", Boolean(invoiceItemArg));
    assert("  and they come from `poItems`, which is the gated level", mentions(invoiceItemArg, "poItems"));
    check("  and not from `pos`", mentions(invoiceItemArg, "pos"), false);

    const invoiceArg = callArgument(list.ast, "getInvoicesByRecordIds");
    assert("the invoice ids are passed inline", Boolean(invoiceArg));
    assert("  and they come from `invoiceItems`", mentions(invoiceArg, "invoiceItems"));
    check("  and not from `pos`", mentions(invoiceArg, "pos"), false);

    // ANTI-VACUITY: the detector has to be seen flagging the widened gather, or every
    // `false` above is what a broken walk reports. This is the mutation, planted.
    log("");
    log("anti-vacuity — the widened gather is seen to be caught:");
    const leaked = parseSource(
        "const ids = pos.flatMap((po) => po.poItems || []);\n" +
            "const invoiceItems = await getInvoiceItemsByRecordIds([\n" +
            "  ...new Set(pos.flatMap((po) => po.invoiceItems || [])),\n" +
            "]);\n",
        "<leaked>"
    );
    assert(
        "a gather off `pos` is reported",
        mentions(declaratorInit(leaked.ast, "ids"), "pos") &&
            mentions(callArgument(leaked.ast, "getInvoiceItemsByRecordIds"), "pos")
    );
    const gated = parseSource(
        "const ids = visible.flatMap((po) => po.poItems || []);\n",
        "<gated>"
    );
    assert(
        "  and the gated one is not",
        !mentions(declaratorInit(gated.ast, "ids"), "pos") &&
            mentions(declaratorInit(gated.ast, "ids"), "visible")
    );

    log("");
    log(`  ${JUDGMENT.length} shared functions and 3 gathers read across 3 files`);
}

/** Every function name this subtree calls. */
function callsNamed(ast) {
    const names = new Set();
    walk(ast, (node) => {
        if (node.type === "CallExpression" && node.callee?.name) names.add(node.callee.name);
    });
    return names;
}

/** Does this subtree mention the identifier `name`? */
function mentions(node, name) {
    if (!node) return false;
    let found = false;
    walk(node, (n) => {
        if (n.type === "Identifier" && n.name === name) found = true;
    });
    return found;
}

/** The initializer of `const <name> = …`, or null. */
function declaratorInit(ast, name) {
    let init = null;
    walk(ast, (node) => {
        if (init) return;
        if (node.type === "VariableDeclarator" && node.id?.name === name) init = node.init ?? null;
    });
    return init;
}

/** The first argument of the first `fn(...)` call, or null. */
function callArgument(ast, fn) {
    let arg = null;
    walk(ast, (node) => {
        if (arg) return;
        if (node.type === "CallExpression" && node.callee?.name === fn) arg = node.arguments?.[0] ?? null;
    });
    return arg;
}

/**
 * Does this file read `<something>.<slot>` inside JSX?
 *
 * The member read rather than the identifier, because both slots are reached off the
 * object the describer returned — `paymentColumn.overdue` on the detail and
 * `row.payment.overdue` in the list's row component — and a bare name would match
 * anything.
 */
function readsSlot(ast, slot) {
    let found = false;
    walk(ast, (container) => {
        if (found) return;
        if (container.type !== "JSXExpressionContainer") return;
        walk(container, (n) => {
            if (n.type === "MemberExpression" && n.property?.name === slot) found = true;
        });
    });
    return found;
}

if (isMain(import.meta.url)) standalone(title, run);
