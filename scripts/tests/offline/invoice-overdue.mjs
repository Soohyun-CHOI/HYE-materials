// One lateness judgment, and the invoice screens do not re-derive it (#316). Source
// shape, on the AST.
//
// WHAT THIS FILE IS FOR, IN ONE SENTENCE: `/invoices` marks a row late and
// `/invoices/[invoiceId]` says the same thing in a sentence, and both render a `Due
// Date` beside it — so if either compared that date to today for itself, the two
// would agree everywhere except at the boundary, where one screen would call the due
// day late and the other would not. That is the quiet mutant, and it is quiet because
// both halves keep working; `offline/po-payment-column.mjs` holds the same shape one
// scope up, where #311 had two screens folding one order's invoices.
//
//   1  ONE JUDGMENT AND ONE SET OF WORDS. Both screens call `invoicePayment` and
//      `describeInvoiceOverdue`. A rule written into either page is a second answer,
//      and the truth table in `offline/delivery-status.mjs` would keep passing over a
//      function one of them no longer uses.
//   2  NEITHER PAGE COMPARES A DUE DATE, AND THE FORM OF THAT CLAIM IS NOT #311's.
//      That check can say `/pos` names no due date at all, because that screen has no
//      column for one. These two DO name it — the list heads a `Due Date` column and
//      the detail prints it in its identity block — so the assertion has to be
//      narrower: they may render it and may not compare it. Nor may they name the day
//      COUNT: a page reaching for `daysWaiting(dueDate, today)` beside the verdict is
//      the same divergence with the figure instead of the boundary.
//   3  THE SENTENCE IS ON THE READ SIDE, WHICH NOTHING ELSE HOLDS. #309 opened
//      reading payment to every reader who reaches the row and left the WRITE behind
//      `user.isAdmin`, so the detail's `Payment` section is an ungated section with an
//      Admin control inside it — and its existing read-only sentence is that control's
//      ALTERNATE, which an Admin never sees. Put the overdue sentence in either side
//      of that branch and half the readers lose a payment fact.
//      `offline/invoice-visibility.mjs`'s rule is the right one and cannot reach this:
//      it finds a payment read by the five shapes `.paid` arrives in, and this line
//      hands the record to `invoicePayment` and names no payment field.
//   4  THE JUDGMENT NEVER STANDS WITHOUT THE FACT IT READS. Both screens keep
//      rendering the due date itself. The badge is a READING of that date —
//      `daysWaiting`'s own docstring settles the pattern: the date is the fact and the
//      count is what makes it scannable, so a reader who doubts the count can check
//      it. Drop the column and the mark becomes an assertion nothing on the page
//      supports. It is also what `offline/po-payment-column.mjs` leans on for its
//      anti-vacuity control — that file proves its "names no due date" walk works by
//      finding one on `app/invoices/page.js` — so the column leaving would make that
//      check vacuous rather than failing. Naming it here is what turns an implicit
//      dependency into an assertion.
//
// WHAT A PASS DOES NOT PROVE. That the two screens AGREE on a given invoice, or that
// either renders anything at all. Source shape is not execution; what it establishes
// is that there is only one rule to disagree with and one place the words come from.
// The agreement itself is read in a browser against a base carrying each boundary, and
// that measurement is recorded in the pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One lateness judgment, two invoice screens (#316)";

/** The list, and the page a reader lands on from it. */
const LIST = "app/invoices/page.js";
const DETAIL = "app/invoices/[invoiceId]/page.js";
/** Where the judgment and its words live. */
const MODULE = "lib/deliveryStatus.js";
/** Where the detail's sentence is RENDERED, since #318 moved the section's body. */
const SECTION = "app/invoices/[invoiceId]/PaymentSection.js";

const JUDGMENT = ["invoicePayment", "describeInvoiceOverdue"];

/** The comparisons that would BE a second lateness rule. */
const COMPARISONS = new Set(["<", ">", "<=", ">=", "===", "!==", "==", "!="]);

export function run({ check, assert, log }) {
    // ── 1: one judgment and one set of words, called by both screens ────────
    log("both invoice screens judge lateness with the same two functions:");
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
        !callsNamed(parseFile(LIST).ast).has("judgeNothingAtAll")
    );

    // AND EACH RENDERS ITS OWN DENSITY'S SLOT. One describer hands over both, so the
    // failure this catches is a cell given the sentence or a section given the badge —
    // which would read as correct on the page that got it right.
    log("");
    log("each screen renders the slot its density is for:");
    assert(`${LIST} reads the badge`, readsSlot(parseFile(LIST).ast, "badge"));
    assert(`  and not the sentence`, !readsSlot(parseFile(LIST).ast, "sentence"));
    assert(`${DETAIL} reads the sentence`, readsSlot(parseFile(DETAIL).ast, "sentence"));
    assert(`  and not the badge`, !readsSlot(parseFile(DETAIL).ast, "badge"));

    // ── 2: neither page owns the lateness rule ──────────────────────────────
    log("");
    log("the due date is rendered by both pages and compared by neither:");
    for (const relPath of [LIST, DETAIL]) {
        const parsed = parseFile(relPath);
        const compared = dueDateComparisons(parsed.ast);
        check(
            `${relPath} compares no due date`,
            compared.length === 0 ? "none" : compared.join(", "),
            "none"
        );
        // The figure is the same rule wearing a number. A page that reached for
        // `daysWaiting(dueDate, today)` beside the verdict would be deriving what the
        // judgment already returned, and the two could then disagree at the boundary.
        assert(`  and names no day count of its own`, !mentions(parsed.ast, "daysOverdue"));
    }
    // ANTI-VACUITY: the same detector has to be seen finding one. This is the mutation,
    // planted — the cell comparing the date it renders.
    const inlined = parseSource(
        "const cell = inv.dueDate && !inv.paid && inv.dueDate < today ? 'Overdue' : null;\n",
        "<inlined>"
    );
    assert("an inline `dueDate < today` is reported", dueDateComparisons(inlined.ast).length === 1);
    // And the field-name form of the same thing, which no member read would catch.
    const byFieldName = parseSource(
        "const late = record.get('Due Date') < today;\n",
        "<by-field-name>"
    );
    assert("  as is the same comparison on the field name", dueDateComparisons(byFieldName.ast).length === 1);
    // The other direction: rendering the date must NOT be reported, or assertion 4
    // and this one would be asking for opposite things.
    const rendered = parseSource("const cell = <td>{inv.dueDate || '—'}</td>;\n", "<rendered>");
    check("  while merely rendering it is not", dueDateComparisons(rendered.ast).length, 0);

    // AND THE MODULE NAMES IT IN ONE PLACE. `PAYMENT_CONTAINERS`' shape, one axis
    // along: a due date read anywhere in this module outside the judgment is a second
    // answer starting, and it would not fail anything for as long as it agreed.
    log("");
    log(`${MODULE} names a due date only inside the judgment:`);
    const judgment = parseFile(MODULE);
    const total = countDueDateReads(judgment.ast);
    const containers = namedContainers(judgment.ast, ["invoicePayment"]);
    const inside = containers.reduce((n, node) => n + countDueDateReads(node), 0);
    assert("  the module reads a due date at all", total > 0);
    check("  and every one of them is inside `invoicePayment`", total - inside, 0);
    check("  the container was found", containers.length, 1);
    // ANTI-VACUITY: the container finder has to be seen missing one it is not given.
    check(
        "  the container finder returns nothing for a name that is not there",
        namedContainers(judgment.ast, ["noSuchContainer"]).length,
        0
    );

    // ── 3: the sentence is on the read side ─────────────────────────────────
    log("");
    log("the invoice detail's sentence sits outside every privilege branch (#309):");
    const detail = parseFile(DETAIL);
    const sentenceReads = countSlotReads(detail.ast, "sentence");
    assert("the page reads the sentence slot at all", sentenceReads > 0);
    const gatedReads = privilegeBranches(detail.ast).reduce(
        (n, branch) =>
            n + countSlotReads(branch.consequent, "sentence") + countSlotReads(branch.alternate, "sentence"),
        0
    );
    check("and none of those reads is inside one", gatedReads, 0);
    // ANTI-VACUITY, BOTH DIRECTIONS. The detector is shown saying YES on the planted
    // mutant — the sentence tucked into the branch the read-only line already sits in
    // — and NO on the shape the page really has.
    const tucked = parseSource(
        "export default function P({ user, invoice, overdue }) {\n" +
            "  return user.isAdmin\n" +
            "    ? <Form />\n" +
            "    : <p>{invoice.paid ? 'Paid' : 'Not paid yet.'}{overdue.sentence.text}</p>;\n" +
            "}\n",
        "<tucked>"
    );
    const tuckedGated = privilegeBranches(tucked.ast).reduce(
        (n, b) => n + countSlotReads(b.consequent, "sentence") + countSlotReads(b.alternate, "sentence"),
        0
    );
    assert("a sentence inside an isAdmin branch is reported", tuckedGated === 1);
    const outside = parseSource(
        "export default function P({ user, overdue }) {\n" +
            "  return <div>{user.isAdmin ? <Form /> : <p>Not paid yet.</p>}<p>{overdue.sentence.text}</p></div>;\n" +
            "}\n",
        "<outside>"
    );
    const outsideGated = privilegeBranches(outside.ast).reduce(
        (n, b) => n + countSlotReads(b.consequent, "sentence") + countSlotReads(b.alternate, "sentence"),
        0
    );
    check("  and the same sentence after the branch is not", outsideGated, 0);
    // The privilege half has to be seen too, or the rule above would be reporting
    // nothing because it collected no branches rather than because they were clean.
    assert("the branch finder found a privilege branch on the real page", privilegeBranches(detail.ast).length > 0);
    check(
        "  and collects none where the test is not a privilege question",
        privilegeBranches(parseSource("const x = a ? b : c;\n", "<plain>").ast).length,
        0
    );

    // ── 3b: and it is not hidden by the control opening either (#318) ───────
    //
    // RE-FOUNDED RATHER THAN DELETED, WHICH THE SHAPE OF THE PAGE FORCED. #316 put this
    // sentence after the section's `isAdmin` ternary and asserted exactly that: outside
    // every privilege branch. **#318 removed the ternary** — the section reads the same
    // for every reader and only its control is Admin's — so "outside the branch" is a
    // claim with no branch left to be outside of, and the assertion above went quietly
    // vacuous on this page the moment the sentence moved into the section's own
    // component. Deleting it would have left the placement unheld; what replaces it is
    // the same claim against the two branches that now exist there.
    //
    // THE SECOND ONE IS THE NEW HAZARD. The sentence is rendered beside an open/closed
    // state, so it can be hidden by `editing` exactly as it could once have been hidden
    // by `user.isAdmin`, and no privilege-shaped rule sees that. It is the same mutant
    // `offline/invoice-visibility.mjs`'s 3b holds for the payment fact; this file holds
    // it for the lateness sentence, because `isPaymentNode` does not match an overdue
    // slot and neither file's predicate should learn the other's subject.
    log("");
    log("nor is it hidden when the control opens (#318):");
    const section = parseFile(SECTION);
    const overdueReads = countSlotReads(section.ast, "text");
    assert(`${SECTION} renders the sentence it was handed`, overdueReads > 0 && mentions(section.ast, "overdue"));
    const hidden = [...privilegeBranches(section.ast), ...stateBranches(section.ast)].filter(
        (b) => mentions(b.consequent, "overdue") !== mentions(b.alternate, "overdue")
    );
    check(
        "no branch on privilege or on the open state carries it on one side only",
        hidden.length,
        0
    );
    // ANTI-VACUITY, BOTH DIRECTIONS. The state-branch finder has to be seen collecting
    // on the real file, or "none of them carries it" is what an empty list reports.
    assert("the state-branch finder found the open state", stateBranches(section.ast).length > 0);
    const tucked318 = parseSource(
        "export default function S({ overdue }) {\n" +
            "  const [editing, setEditing] = useState(false);\n" +
            "  return <div>{!editing && overdue && <p>{overdue.text}</p>}</div>;\n" +
            "}\n",
        "<tucked-318>"
    );
    // Counted as "reported at all" rather than as one finding: `!editing && overdue &&
    // <p/>` nests two `&&`s and the finder collects both, which is the detector working
    // rather than double-reporting a second defect.
    assert(
        "the sentence behind `!editing` is reported",
        stateBranches(tucked318.ast).filter(
            (b) => mentions(b.consequent, "overdue") !== mentions(b.alternate, "overdue")
        ).length > 0
    );
    const beside = parseSource(
        "export default function S({ overdue }) {\n" +
            "  const [editing, setEditing] = useState(false);\n" +
            "  return <div>{overdue && <p>{overdue.text}</p>}{editing && <form />}</div>;\n" +
            "}\n",
        "<beside>"
    );
    check(
        "  and the same sentence beside the control is not",
        stateBranches(beside.ast).filter(
            (b) => mentions(b.consequent, "overdue") !== mentions(b.alternate, "overdue")
        ).length,
        0
    );

    // ── 4: the mark never stands without the date it reads ──────────────────
    log("");
    log("both screens still render the due date the mark is a reading of:");
    for (const relPath of [LIST, DETAIL]) {
        assert(`${relPath} renders a due date`, rendersDueDate(parseFile(relPath).ast));
    }
    // ANTI-VACUITY: a page with the column taken out has to come back false, or
    // "renders it" is what a blind walk reports of anything.
    const columnless = parseSource(
        "const row = <tr><td>{inv.invoiceId}</td><td>{inv.issueDate || '—'}</td></tr>;\n",
        "<columnless>"
    );
    assert("a page with no due date on it is reported", !rendersDueDate(columnless.ast));

    log("");
    log(`  ${JUDGMENT.length} shared functions, 2 slots and 1 container read across 3 files`);
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

/**
 * Is THIS ONE NODE a due date? The three shapes it reaches code in — a member read,
 * a bare local, and the Airtable field name as a literal.
 *
 * ONE DEFINITION, THREE CALLERS, for `isPaymentNode`'s reason one file over: the
 * comparison rule, the module's container rule and the render rule all have to agree
 * about what a due date IS, or the first two go quietly vacuous while the third passes.
 */
function isDueDateNode(n) {
    switch (n.type) {
        case "MemberExpression":
            return !n.computed && n.property?.name === "dueDate";
        case "Identifier":
            return n.name === "dueDate";
        case "Literal":
            return n.value === "Due Date";
        default:
            return false;
    }
}

/** How many due dates a subtree names, counting each node once. */
function countDueDateReads(node) {
    let n = 0;
    walk(node, (candidate) => {
        if (isDueDateNode(candidate)) n += 1;
    });
    return n;
}

/**
 * Every comparison in this subtree with a due date on one side, as its operator.
 *
 * The OPERATOR rather than the node, so a failure names what it found. Only binary
 * comparisons: `dueDate || "—"` is a render fallback and `Boolean(dueDate)` is a
 * presence test, neither of which decides lateness.
 */
function dueDateComparisons(ast) {
    const found = [];
    walk(ast, (node) => {
        if (node.type !== "BinaryExpression" || !COMPARISONS.has(node.operator)) return;
        const names = (side) => {
            let hit = false;
            walk(side, (n) => {
                if (isDueDateNode(n)) hit = true;
            });
            return hit;
        };
        if (names(node.left) || names(node.right)) found.push(node.operator);
    });
    return found;
}

/** Does this file render a due date inside JSX? */
function rendersDueDate(ast) {
    let found = false;
    walk(ast, (container) => {
        if (found) return;
        if (container.type !== "JSXExpressionContainer") return;
        walk(container, (n) => {
            if (isDueDateNode(n)) found = true;
        });
    });
    return found;
}

/**
 * Does this file read `<something>.<slot>` inside JSX?
 *
 * The member read rather than the identifier, for the reason
 * `offline/po-payment-column.mjs` gives: both slots are reached off the object the
 * describer returned, and a bare name would match anything.
 */
function readsSlot(ast, slot) {
    return countSlotReads(ast, slot) > 0;
}

/** How many `<something>.<slot>` reads a subtree holds, JSX or not. */
function countSlotReads(node, slot) {
    if (!node) return 0;
    let n = 0;
    walk(node, (candidate) => {
        if (candidate.type === "MemberExpression" && !candidate.computed && candidate.property?.name === slot) {
            n += 1;
        }
        // The destructured form, which is how both pages take their slot:
        // `const { badge } = describeInvoiceOverdue(…)`.
        if (candidate.type === "Property" && candidate.key?.name === slot && candidate.shorthand) n += 1;
    });
    return n;
}

/**
 * Every branch in this subtree whose test asks who the reader is, as
 * `{ test, consequent, alternate }`.
 *
 * The three shapes a gate is written in, `offline/invoice-visibility.mjs`'s set: a
 * ternary, a `&&`, and an `if`. Narrower than that file's, deliberately — it resolves
 * locals that HOLD a privilege answer because `/invoices` has one shaped by privilege
 * that is not an answer; this page has no such local and no `seesEveryInvoice` call
 * left (#314), so the terms themselves are the whole set.
 */
function privilegeBranches(ast) {
    const out = [];
    walk(ast, (node) => {
        if (node.type === "ConditionalExpression" || node.type === "IfStatement") {
            if (asksPrivilege(node.test)) {
                out.push({ test: node.test, consequent: node.consequent, alternate: node.alternate ?? null });
            }
            return;
        }
        if (node.type === "LogicalExpression" && node.operator === "&&" && asksPrivilege(node.left)) {
            out.push({ test: node.left, consequent: node.right, alternate: null });
        }
    });
    return out;
}

/**
 * Every branch whose test asks what state the section is in (#318).
 *
 * A SECOND COPY OF `offline/invoice-visibility.mjs`'s HELPER, DELIBERATELY, and for the
 * reason `privilegeBranches` above is already a second copy of that file's: each file
 * asks the question of its own subject, and a shared helper would put one file's notion
 * of a rendered fact inside the other's rule. The locals come off `useState` rather than
 * off a name list, which is the property that survives a rename of `editing`.
 */
function stateBranches(ast) {
    const locals = new Set();
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.type !== "ArrayPattern") return;
        if (node.init?.type !== "CallExpression" || node.init.callee?.name !== "useState") return;
        const first = node.id.elements?.[0];
        if (first?.type === "Identifier") locals.add(first.name);
    });
    const out = [];
    walk(ast, (node) => {
        const test =
            node.type === "ConditionalExpression" || node.type === "IfStatement"
                ? node.test
                : node.type === "LogicalExpression" && node.operator === "&&"
                  ? node.left
                  : null;
        if (!test) return;
        let asks = false;
        walk(test, (n) => {
            if (n.type === "Identifier" && locals.has(n.name)) asks = true;
        });
        if (!asks) return;
        out.push({
            test,
            consequent: node.type === "LogicalExpression" ? node.right : node.consequent,
            alternate: node.type === "LogicalExpression" ? null : (node.alternate ?? null),
        });
    });
    return out;
}

const PRIVILEGE_FIELDS = new Set(["isAdmin", "role"]);
const PRIVILEGE_CALLS = new Set(["seesEveryInvoice", "requireAdmin", "requirePresident"]);

/** Does this expression ask who the reader is? */
function asksPrivilege(node) {
    if (!node) return false;
    let asks = false;
    walk(node, (n) => {
        if (asks) return;
        if (n.type === "MemberExpression" && PRIVILEGE_FIELDS.has(n.property?.name)) asks = true;
        if (n.type === "Identifier" && PRIVILEGE_FIELDS.has(n.name)) asks = true;
        if (n.type === "CallExpression" && PRIVILEGE_CALLS.has(n.callee?.name)) asks = true;
        if (n.type === "Literal" && n.value === "President") asks = true;
    });
    return asks;
}

/**
 * The function declarations, arrow assignments and object properties in this file
 * whose name is one of `names` — the containers a due date is allowed inside.
 */
function namedContainers(ast, names) {
    const out = [];
    walk(ast, (node) => {
        if (node.type === "FunctionDeclaration" && names.includes(node.id?.name)) out.push(node);
        if (node.type === "VariableDeclarator" && names.includes(node.id?.name) && node.init) {
            out.push(node.init);
        }
        if (node.type === "Property" && names.includes(node.key?.name ?? node.key?.value)) {
            out.push(node.value);
        }
    });
    return out;
}

if (isMain(import.meta.url)) standalone(title, run);
