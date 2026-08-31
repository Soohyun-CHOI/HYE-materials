// One Job column on four document lists, and one judgment behind the invoice's (#314).
//
// WHAT THIS FILE IS FOR, IN THREE SENTENCES. `/prs`, `/pos` and `/deliveries` reach a
// job through a link they hold; `/invoices` has to walk to the request behind an order
// to find one, and #211 split that walk into two readers — one who runs it and one who
// skips it. A job resolved on each side of that split is a rendered fact that can
// differ by reader on one row, with both halves looking right and nothing failing.
// And the same issue removed a column from two other lists, which leaves the read
// behind it costing an operation for a value no screen shows.
//
//   1  THE JUDGMENT TAKES NO READER. `jobForInvoices` is pure, and its parameters are
//      the data — no `user`, no privilege term anywhere in the module. A function with
//      no reader cannot differ by reader, which is stronger than any assertion about
//      call sites and is the shape #309 left `resolveDeleteCopy` in. `_shared.md`
//      states the standing rule: no table in this app drops a column by reader, and
//      the fact is not what varies.
//   2  IT NAMES ONE JOB OR NONE, AND NEVER PICKS. The column asserts one job because
//      the one-delivery premise says an invoice charges one — but nothing on the write
//      side enforces that, so the state is reachable by hand. Asserted BEHAVIORALLY,
//      the module being import-free: two orders on one job is the ordinary case and
//      must name it, two orders on two jobs must name nothing.
//   3  NO PRIVILEGE BRANCH CARRIES THE JOB ON ONE SIDE ONLY. `offline/invoice-
//      visibility.mjs` assertion 3's rule, applied to the job fact instead of the
//      payment fact. That file also holds the stricter thing this rests on: neither
//      invoice route asks `seesEveryInvoice` at all any more.
//   4  THE JOB MAP IS BUILT FROM EVERY JOB, AND THE ITEM LEVEL FROM THE GATED ROWS.
//      `/invoices` holds two job locals — every job, and the delivery-scoped
//      narrowing — and feeding the column from the narrow one blanks the cell for a
//      job outside the reader's delivery scope, which is a reader-dependent column
//      arriving by the back door. The second half is #169's gather rule, which this
//      issue newly needs here: the items handed to `getInvoiceDeliveryStatus` feed a
//      `PO Items` read, so an ungated hand-over puts a refused row's ordered items on
//      the wire.
//   5  ONE WORD ON FOUR LISTS, AND THE READ WENT WITH THE COLUMN. The four render
//      files head `Job` and none of them heads a pair; `/prs` and `/pos` fetch no
//      Disciplines level and name no discipline. **This is the mutant particular to
//      this issue:** remove the render, leave the read, and the screen is right, the
//      budget is unchanged and nothing anywhere fails.
//   6  AND THE WORD HAS A HOME. `/pos`'s column was the only place an order's
//      discipline appeared anywhere in the app, so removing it without adding one is a
//      loss rather than a tidying-up. `/pos/[poId]` names it now, as `/prs/[prId]`
//      already did.
//
// WHAT A PASS DOES NOT PROVE. That the column renders, or that the two readers see the
// same code on a given row. Source shape is not execution and this tier renders no
// page; the agreement itself is read in a browser with the two fixture accounts, and
// the operation counts are read off `.airtable-ops.jsonl`. Both are recorded in the
// pull request.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { jobForInvoices } from "../../../lib/invoiceJob.js";
import { parseFile, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "One Job column, one judgment behind the invoice's (#314)";

/** The invoice list, and the module that answers its column. */
const LIST = "app/invoices/page.js";
const JUDGMENT = "lib/invoiceJob.js";

/**
 * Where each list's `<th>` row lives. Three are Client Components, so the JSX is not
 * on the page; the invoice list renders its own table. Read as: these are the four
 * document lists, and this is the file each one's header is in.
 */
const HEADER_FILES = {
    "/prs": "app/prs/PRListClient.js",
    "/pos": "app/pos/POListClient.js",
    "/deliveries": "app/deliveries/DeliveriesListClient.js",
    "/invoices": "app/invoices/page.js",
};

/** The two pages that stopped reading the level, and the strips that stopped rendering it. */
const DISCIPLINE_FREE = [
    "app/prs/page.js",
    "app/prs/PRListClient.js",
    "app/pos/page.js",
    "app/pos/POListClient.js",
    "app/pos/AwaitingPOStrip.js",
    "app/pos/AwaitingSendStrip.js",
];

/** The two screens a discipline legitimately lives on — the controls for assertion 5. */
const DISCIPLINE_HOMES = ["app/prs/[prId]/page.js", "app/pos/[poId]/page.js"];

const PRIVILEGE_CALLS = new Set(["seesEveryInvoice", "requireAdmin", "requirePresident"]);
const PRIVILEGE_FIELDS = new Set(["isAdmin", "role"]);

export function run({ check, assert, log }) {
    // ── 1: the judgment takes no reader ─────────────────────────────────────
    log("the judgment's inputs are data, and nothing in it asks who is reading:");
    const judgment = parseFile(JUDGMENT);
    const params = destructuredParams(judgment.ast, "jobForInvoices");
    assert("jobForInvoices destructures its one argument", Boolean(params));
    check("  and takes exactly the three levels", (params || []).join(","), "invoiceItems,poById,prById");

    const asked = privilegeTermsIn(judgment.ast);
    check(
        `the module asks no privilege question${asked.length ? ` (${asked.join(", ")})` : ""}`,
        asked.length,
        0
    );
    // `user` is not a privilege TERM but it is the parameter that would carry one, so
    // it is barred by name: a judgment handed the reader can start branching on them
    // without naming a role at all.
    let namesUser = false;
    walk(judgment.ast, (node) => {
        if (node.type === "Identifier" && node.name === "user") namesUser = true;
    });
    assert("  and names no `user` either", !namesUser);

    // ANTI-VACUITY, both halves: the detector has to be seen reporting a module that
    // does ask, and a signature it can really read.
    const readerBound = parseSource(
        "export function jobForInvoices({ user, invoiceItems }) {\n" +
            "  return seesEveryInvoice(user) ? new Map() : new Map();\n" +
            "}\n",
        "<reader-bound>"
    );
    assert(
        "a judgment handed the reader is reported",
        privilegeTermsIn(readerBound.ast).length > 0 &&
            destructuredParams(readerBound.ast, "jobForInvoices").includes("user")
    );
    check(
        "  and the signature reader works on a known one",
        destructuredParams(parseSource("function f({ a, b }) {}", "<probe>").ast, "f").join(","),
        "a,b"
    );

    // ── 2: one job or none, and never a pick ────────────────────────────────
    //
    // CALLED RATHER THAN READ, which is what being import-free buys. The cases are the
    // premise's own: an invoice charges orders on one job (`docs/notes/
    // deliveries-and-invoices.md`, `## The one-delivery premise`), so two orders on ONE
    // job is the ordinary reason to carry two — a correction that split every item
    // across an order and its overage order — and two orders on two jobs is the state
    // no write of this app produces and no hand edit is stopped from producing.
    log("");
    log("the judgment names one job or none, and never picks between two:");
    const poById = new Map([
        ["poA", { id: "poA", pr: ["prA"] }],
        ["poB", { id: "poB", pr: ["prB"] }],
        ["poNoJob", { id: "poNoJob", pr: ["prNoJob"] }],
        ["poNoRequest", { id: "poNoRequest", pr: [] }],
    ]);
    const prById = new Map([
        ["prA", { id: "prA", job: ["jobOne"] }],
        // Two requests, ONE job — the overage split. Distinct requests must not read as
        // distinct jobs, which is why the judgment counts jobs rather than orders.
        ["prB", { id: "prB", job: ["jobOne"] }],
        ["prNoJob", { id: "prNoJob", job: [] }],
    ]);
    const twoJobsPrById = new Map([
        ["prA", { id: "prA", job: ["jobOne"] }],
        ["prB", { id: "prB", job: ["jobTwo"] }],
    ]);
    const item = (invoice, po) => ({ invoice: [invoice], po: [po] });

    const oneOrder = jobForInvoices({ invoiceItems: [item("inv1", "poA")], poById, prById });
    check("one order on one job names it", oneOrder.get("inv1"), "jobOne");

    const twoOrdersOneJob = jobForInvoices({
        invoiceItems: [item("inv1", "poA"), item("inv1", "poB")],
        poById,
        prById,
    });
    check("two orders on one job name it too", twoOrdersOneJob.get("inv1"), "jobOne");

    const twoOrdersTwoJobs = jobForInvoices({
        invoiceItems: [item("inv1", "poA"), item("inv1", "poB")],
        poById,
        prById: twoJobsPrById,
    });
    check("two orders on two jobs name NEITHER", twoOrdersTwoJobs.get("inv1"), null);
    // The distinction that makes the line above a rule rather than an accident: the
    // test is the number of distinct JOBS, so an order count of two is not what
    // silenced it.
    assert(
        "  and it is the job count that decides, not the order count",
        twoOrdersOneJob.get("inv1") === "jobOne" && twoOrdersTwoJobs.get("inv1") === null
    );

    const noJob = jobForInvoices({ invoiceItems: [item("inv1", "poNoJob")], poById, prById });
    check("a request with no job leaves no entry", noJob.has("inv1"), false);
    const noRequest = jobForInvoices({
        invoiceItems: [item("inv1", "poNoRequest")],
        poById,
        prById,
    });
    check("an order whose request did not resolve leaves none either", noRequest.has("inv1"), false);
    // An entry the caller cannot find and one it finds empty render the same dash, so
    // the two need not be told apart — but they must both be silent rather than one of
    // them naming something.
    check(
        "so a missing entry and a null one agree",
        [noJob.get("inv1"), twoOrdersTwoJobs.get("inv1")].every((v) => !v),
        true
    );

    // Invoices are kept apart: one row's orders must not answer another's.
    const twoInvoices = jobForInvoices({
        invoiceItems: [item("inv1", "poA"), item("inv2", "poB")],
        poById,
        prById: twoJobsPrById,
    });
    check("two invoices are judged separately (first)", twoInvoices.get("inv1"), "jobOne");
    check("  and the second", twoInvoices.get("inv2"), "jobTwo");

    // ── 3: no privilege branch carries the job ──────────────────────────────
    log("");
    log("the invoice list derives no job on one side of a privilege test:");
    const list = parseFile(LIST);
    const locals = privilegeLocals(list.ast);
    const branched = [];
    for (const branch of privilegeBranches(list.ast, locals)) {
        const inConsequent = readsJob(branch.consequent);
        const inAlternate = readsJob(branch.alternate);
        if (inConsequent === inAlternate) continue;
        branched.push(`${LIST}:${lineOf(list.source, branch.node.start)}`);
    }
    check(
        `job reads behind a privilege branch${branched.length ? ` (${branched.join("; ")})` : ""}`,
        branched.length,
        0
    );
    // ANTI-VACUITY: the exact mutant — the job resolved one way for a reader who walks
    // and another for one who does not.
    const forked = parseSource(
        "const privileged = seesEveryInvoice(user);\n" +
            "const jobByInvoice = privileged\n" +
            "  ? jobFromDelivery(deliveries)\n" +
            "  : jobForInvoices({ invoiceItems, poById, prById });\n",
        "<forked>"
    );
    const forkedFindings = privilegeBranches(forked.ast, privilegeLocals(forked.ast)).filter(
        (b) => readsJob(b.consequent) !== readsJob(b.alternate)
    );
    assert("a job resolved two ways behind a privilege test is reported", forkedFindings.length === 1);

    // ── 4: built from every job, and the item level from the gated rows ─────
    log("");
    log("the column reads every job, and hands the gated items down:");
    const jobMap = declaratorInit(list.ast, "jobById");
    assert("the job map is declared at all", Boolean(jobMap));
    assert("  and it is built from `allJobs`", mentions(jobMap, "allJobs"));
    check("  and not from `deliveryJobs`", mentions(jobMap, "deliveryJobs"), false);
    // The narrowing still exists and is still narrowed — a check that only forbade the
    // narrow local would pass on a page that had stopped narrowing at all.
    const narrowed = declaratorInit(list.ast, "deliveryJobs");
    assert("the delivery scope is still narrowed", Boolean(narrowed) && mentions(narrowed, "accessibleJobs"));

    const statusCall = callArguments(list.ast, "getInvoiceDeliveryStatus");
    check("getInvoiceDeliveryStatus is handed two arguments", (statusCall || []).length, 2);
    assert(
        "  and the second is filtered on the gate's answer",
        mentions(statusCall?.[1], "visibleIds")
    );
    // ANTI-VACUITY: the ungated hand-over is seen to be caught.
    const ungated = parseSource(
        "const r = await getInvoiceDeliveryStatus(invoices, invoiceItems);\n" +
            "const jobById = new Map(deliveryJobs.map((j) => [j.id, j]));\n",
        "<ungated>"
    );
    assert(
        "an unfiltered hand-over and a narrowed job map are both reported",
        !mentions(callArguments(ungated.ast, "getInvoiceDeliveryStatus")?.[1], "visibleIds") &&
            mentions(declaratorInit(ungated.ast, "jobById"), "deliveryJobs")
    );

    // ── 5: one word on four lists, and the read gone with the column ────────
    log("");
    log("all four document lists head the column with one word:");
    for (const [route, relPath] of Object.entries(HEADER_FILES)) {
        const heads = tableHeads(parseFile(relPath).ast);
        check(`${route} heads it \`Job\``, heads.filter((h) => h === "Job").length, 1);
        const paired = heads.filter((h) => h.includes("Discipline"));
        check(
            `  and heads no pair${paired.length ? ` (${paired.join(", ")})` : ""}`,
            paired.length,
            0
        );
    }
    // ANTI-VACUITY: the head reader has to be seen finding the retired heading, or
    // "no pair anywhere" is what a walk that visits no JSX reports.
    const oldHeading = parseSource(
        "const T = () => <tr><th>Job / Discipline</th><th>Total</th></tr>;\n",
        "<old-heading>"
    );
    const oldHeads = tableHeads(oldHeading.ast);
    assert("the retired heading is seen by the head reader", oldHeads.includes("Job / Discipline"));
    assert("  and a plain neighbor beside it", oldHeads.includes("Total"));

    log("");
    log("and the read went with it — neither list fetches or names a discipline:");
    for (const relPath of DISCIPLINE_FREE) {
        const parsed = parseFile(relPath);
        const named = disciplineNames(parsed.ast);
        check(
            `${relPath} names none${named.length ? ` (${[...new Set(named)].join(", ")})` : ""}`,
            named.length,
            0
        );
    }
    // ANTI-VACUITY, and it is the one that matters most here: the detector must be seen
    // finding a discipline where one legitimately remains. Both of these render the
    // word on purpose — the second because this issue put it there — so a detector
    // reporting zero across the app would be reporting its own blindness.
    for (const relPath of DISCIPLINE_HOMES) {
        assert(
            `  the detector finds one on ${relPath}, where it belongs`,
            disciplineNames(parseFile(relPath).ast).length > 0
        );
    }

    // ── 6: the word has a home ──────────────────────────────────────────────
    log("");
    log("an order's discipline is on the order's own page, which is what makes the removal not a loss:");
    const detail = parseFile("app/pos/[poId]/page.js");
    const detailHeads = jsxTexts(detail.ast).filter((t) => t.startsWith("Discipline"));
    assert("app/pos/[poId]/page.js renders a Discipline line", detailHeads.length > 0);
    assert(
        "  and reads the row to fill it",
        callsNamed(detail.ast).has("getDisciplineByRecordId")
    );
    // The request's own screen still does, which is the pair the two describe one way.
    assert(
        "app/prs/[prId]/page.js still renders one",
        jsxTexts(parseFile("app/prs/[prId]/page.js").ast).some((t) => t.startsWith("Discipline"))
    );

    log("");
    log(`  4 lists, ${DISCIPLINE_FREE.length} files swept, 1 judgment called on 7 shapes`);
}

/** The property names of a function's one destructured argument, or null. */
function destructuredParams(ast, name) {
    let params = null;
    walk(ast, (node) => {
        if (params) return;
        const fn =
            node.type === "FunctionDeclaration" && node.id?.name === name
                ? node
                : node.type === "VariableDeclarator" &&
                    node.id?.name === name &&
                    (node.init?.type === "ArrowFunctionExpression" ||
                        node.init?.type === "FunctionExpression")
                  ? node.init
                  : null;
        if (!fn) return;
        const first = fn.params[0];
        const pattern = first?.type === "AssignmentPattern" ? first.left : first;
        if (pattern?.type !== "ObjectPattern") return;
        params = pattern.properties.map((p) => p.key?.name ?? p.key?.value ?? `<${p.type}>`);
    });
    return params;
}

/** Every privilege term this subtree mentions — the call, the field, the role string. */
function privilegeTermsIn(node) {
    const found = [];
    walk(node, (n) => {
        if (n.type === "CallExpression" && PRIVILEGE_CALLS.has(n.callee?.name)) {
            found.push(n.callee.name);
        }
        if (n.type === "MemberExpression" && PRIVILEGE_FIELDS.has(n.property?.name)) {
            found.push(n.property.name);
        }
        if (n.type === "Literal" && n.value === "President") found.push("President");
    });
    return found;
}

/**
 * Does this subtree read a JOB?
 *
 * The shapes a job reaches this page in: the judgment's own call, the map it is looked
 * up in, and the code that is rendered. `job` alone would match `deliveryJobs` and
 * `accessibleJobs`, which are the delivery scope rather than the column, so the names
 * are exact.
 */
const JOB_NAMES = new Set(["jobByInvoice", "jobById", "jobCode", "jobForInvoices"]);

function readsJob(node) {
    if (!node) return false;
    let reads = false;
    walk(node, (n) => {
        if (reads) return;
        if (n.type === "Identifier" && JOB_NAMES.has(n.name)) reads = true;
        if (n.type === "MemberExpression" && JOB_NAMES.has(n.property?.name)) reads = true;
    });
    return reads;
}

/**
 * Every discipline name this subtree touches — the reader, the map, the field.
 *
 * `Discipline` as a JSX text node is deliberately NOT one of these: `/pos/[poId]`'s own
 * label is that string, and a file rendering the label is the thing assertion 6 wants
 * to find. What assertion 5 forbids is READING the level, which is what these four
 * identifiers are.
 */
const DISCIPLINE_NAMES = new Set([
    "getAllDisciplines",
    "getDisciplineByRecordId",
    "disciplineById",
    "disciplineName",
    "disciplineLabel",
]);

function disciplineNames(node) {
    const found = [];
    walk(node, (n) => {
        if (n.type === "Identifier" && DISCIPLINE_NAMES.has(n.name)) found.push(n.name);
        if (n.type === "MemberExpression" && DISCIPLINE_NAMES.has(n.property?.name)) {
            found.push(n.property.name);
        }
    });
    return found;
}

/** The text of every `<th>` in this file, whitespace collapsed. */
function tableHeads(ast) {
    const out = [];
    walk(ast, (node) => {
        if (node.type !== "JSXElement") return;
        if (node.openingElement?.name?.name !== "th") return;
        const text = node.children
            .filter((c) => c.type === "JSXText")
            .map((c) => c.value)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        if (text) out.push(text);
    });
    return out;
}

/** Every non-empty JSX text node in this file, whitespace collapsed. */
function jsxTexts(ast) {
    const out = [];
    walk(ast, (node) => {
        if (node.type !== "JSXText") return;
        const text = node.value.replace(/\s+/g, " ").trim();
        if (text) out.push(text);
    });
    return out;
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

/** The argument list of the first `fn(...)` call, or null. */
function callArguments(ast, fn) {
    let args = null;
    walk(ast, (node) => {
        if (args) return;
        if (node.type === "CallExpression" && node.callee?.name === fn) args = node.arguments ?? null;
    });
    return args;
}

/**
 * The locals in this file that HOLD a privilege answer, and the branches whose test
 * asks one.
 *
 * BOTH ARE `offline/invoice-visibility.mjs`'s, DELIBERATELY RE-DERIVED RATHER THAN
 * IMPORTED. That file's rule is about the payment fact and this one's is about the job;
 * sharing the walkers would make one check's mutation coverage depend on the other's
 * name lists, and the two ban different identifiers. The shapes themselves — a
 * ternary, a `&&`, an `if`, and a local that holds rather than merely depends on the
 * answer — are the same because a privilege gate has the same three spellings whatever
 * fact sits behind it.
 */
function privilegeLocals(ast) {
    const locals = new Set();
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") return;
        if (node.init && holdsPrivilegeAnswer(node.init, locals)) locals.add(node.id.name);
    });
    return locals;
}

function holdsPrivilegeAnswer(node, locals) {
    if (!node) return false;
    switch (node.type) {
        case "CallExpression":
            return PRIVILEGE_CALLS.has(node.callee?.name);
        case "MemberExpression":
            return PRIVILEGE_FIELDS.has(node.property?.name);
        case "Identifier":
            return locals.has(node.name);
        case "UnaryExpression":
            return node.operator === "!" && holdsPrivilegeAnswer(node.argument, locals);
        case "LogicalExpression":
            return (
                holdsPrivilegeAnswer(node.left, locals) || holdsPrivilegeAnswer(node.right, locals)
            );
        case "BinaryExpression":
            return (
                holdsPrivilegeAnswer(node.left, locals) ||
                holdsPrivilegeAnswer(node.right, locals) ||
                node.left?.value === "President" ||
                node.right?.value === "President"
            );
        default:
            return false;
    }
}

function asksPrivilege(node, locals) {
    if (!node) return false;
    let asks = false;
    walk(node, (n) => {
        if (asks) return;
        if (n.type === "CallExpression" && PRIVILEGE_CALLS.has(n.callee?.name)) asks = true;
        if (n.type === "MemberExpression" && PRIVILEGE_FIELDS.has(n.property?.name)) asks = true;
        if (n.type === "Identifier" && locals.has(n.name)) asks = true;
        if (n.type === "Literal" && n.value === "President") asks = true;
    });
    return asks;
}

function privilegeBranches(ast, locals) {
    const out = [];
    walk(ast, (node) => {
        if (node.type === "ConditionalExpression" || node.type === "IfStatement") {
            if (asksPrivilege(node.test, locals)) {
                out.push({
                    node,
                    test: node.test,
                    consequent: node.consequent,
                    alternate: node.alternate ?? null,
                });
            }
            return;
        }
        if (node.type === "LogicalExpression" && node.operator === "&&") {
            if (asksPrivilege(node.left, locals)) {
                out.push({ node, test: node.left, consequent: node.right, alternate: null });
            }
        }
    });
    return out;
}

/** 1-indexed line of a character offset, so a finding names something openable. */
function lineOf(source, offset) {
    return source.slice(0, offset).split("\n").length;
}

if (isMain(import.meta.url)) standalone(title, run);
