// An Admin accepts an invoice's variance with a reason, and a write that moves what it was
// accepted on ends it (#648).
//
// WHAT IS HELD, IN THE ORDER A DEFECT WOULD COST THE MOST.
//
//   1. THE JUDGMENT. `acceptanceAfter` over `varianceFigures`: an acceptance stands while its
//      variance stands on the two figures it was given, is `Reopened` when either figure moves
//      and the variance still stands, and `Cleared` when it no longer does. Each kind's figures
//      are its own — a quantity edit leaves a price acceptance standing — and a quantity's are the
//      item's own `Qty`, never `Invoiced Qty`, so another invoice charging the same ordered item
//      cannot be what reopens this one. A cache with no `Accepted` row under it stands on nothing.
//   2. ONE WRITER ENDS ACCEPTANCES, AND EVERY WRITE OF A FLAG ON A STORED ROW GOES THROUGH IT.
//      The quiet mutant is a third place recomputing a flag inline — the shape the edit action
//      and an overage's split each had until here — which would move a figure and leave the
//      cache saying `accepted`. So a flag is written in two places in `app/` and `lib/`: the
//      create action, on rows no acceptance can stand on yet, and `lib/variance.server.js`. The
//      three caches are written there alone, each after its `Invoice Variance Log` row.
//   3. THE PAIR (#185). The control is behind `canAccept`, the page hands it `user.isAdmin`, and
//      the action is `withAdminAction`; what an acceptance says — the badge and who, when and why
//      — is behind neither, because it is a fact of the invoice for every reader (#309's grade).
//   4. THE PAYMENT CHECK asks and never refuses, and states the delivery wait without a warning's
//      color.
//   5. THE WORDS. An accepted badge leads with its kind's word and carries no `⚠`, and the select
//      the schema script made holds the same words the code writes, choice for choice.

import { readFileSync } from "node:fs";
import {
    ACCEPTANCE_COPY,
    PAYMENT_CHECK_COPY,
    VARIANCE_COPY,
    VARIANCE_EVENTS,
    VARIANCE_EVENT_VALUES,
    VARIANCE_KINDS,
    VARIANCE_KIND_VALUES,
    acceptanceAfter,
    foldVarianceStates,
    latestVarianceEntry,
    openVariances,
    varianceFigures,
    varianceNote,
    varianceState,
} from "../../../lib/variance.js";
import { foldInvoiceItems } from "../../../lib/invoiceItemFold.js";
import {
    callPassesProperty,
    callsTo,
    listJsFiles,
    parentMap,
    parseFile,
    parseSource,
    repoPath,
    resolveFunction,
    toPosix,
    walk,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "An invoice's variances are accepted with a reason and reopened by what moves them (#648)";

/** Every call under `app/` and `lib/` to `fn` passing any of `props`, as `file:function`. */
function writesOf(files, fn, props) {
    const found = [];
    for (const file of files) {
        const rel = toPosix(file.slice(repoPath("").length));
        const source = readFileSync(file, "utf8");
        if (!source.includes(fn)) continue;
        const { ast } = parseSource(source, rel);
        const parents = parentMap(ast);
        for (const call of callsTo(ast, fn)) {
            if (!props.some((p) => callPassesProperty(call, p))) continue;
            found.push(`${rel}:${enclosingName(parents, call)}`);
        }
    }
    return found;
}

/** The name of the function or `const` a node sits in, outermost-named. */
function enclosingName(parents, node) {
    let cur = parents.get(node);
    let name = "<module>";
    while (cur) {
        if (cur.type === "FunctionDeclaration" && cur.id) name = cur.id.name;
        if (cur.type === "VariableDeclarator" && cur.id?.type === "Identifier" && name === "<module>") name = cur.id.name;
        cur = parents.get(cur);
    }
    return name;
}

/**
 * The JSX elements named `tag` in a function, each with whether an ancestor expression tests
 * `guard` — a `guard && …` or a `guard ? … : …` above it.
 */
function guardedElements(fn, tag, guard) {
    const parents = parentMap(fn);
    const out = [];
    walk(fn, (node) => {
        if (node.type !== "JSXElement") return;
        const name = node.openingElement.name;
        if (name.type !== "JSXIdentifier" || name.name !== tag) return;
        let cur = parents.get(node);
        let guarded = false;
        while (cur && cur !== fn) {
            const test = cur.type === "LogicalExpression" ? cur.left : cur.type === "ConditionalExpression" ? cur.test : null;
            if (test) {
                walk(test, (n) => {
                    if (n.type === "Identifier" && n.name === guard) guarded = true;
                });
            }
            cur = parents.get(cur);
        }
        out.push({ node, guarded });
    });
    return out;
}

/** An `Invoice Variance Log` row as the mapper hands it. */
const entry = (id, kind, event, item, extra = {}) => ({
    invoiceVarianceLogId: `HYE-INV-261113-01-${String(id).padStart(3, "0")}`,
    variance: VARIANCE_KINDS[kind],
    event,
    invoiceItem: item ? [item] : [],
    recordedBy: ["usrA"],
    eventAt: `2026-11-13T0${id % 10}:00:00.000Z`,
    reason: "agreed with the vendor",
    ...extra,
});

/** The schema script's two selects, read off its AST rather than run (it writes). */
function schemaChoices() {
    const { ast } = parseFile("scripts/import/ran/add_invoice_variance_log_648.mjs");
    const lists = {};
    walk(ast, (node) => {
        if (node.type !== "VariableDeclarator" || !["VARIANCE_CHOICES", "EVENT_CHOICES"].includes(node.id?.name)) return;
        lists[node.id.name] = node.init.elements.map(
            (el) => el.properties.find((p) => p.key.name === "name").value.value
        );
    });
    return lists;
}

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("1. what an acceptance becomes when its row is judged again:");
    const at = { vendor: 9, ours: 8.5 };
    check("the same figures, the variance standing: it stands", acceptanceAfter({ stands: true, accepted: at, figures: { vendor: 9, ours: 8.5 } }), null);
    check("  and binary noise under half a cent is the same figure", acceptanceAfter({ stands: true, accepted: at, figures: { vendor: 9.0000000001, ours: 8.5 } }), null);
    check("the vendor's figure moved a cent: reopened", acceptanceAfter({ stands: true, accepted: at, figures: { vendor: 9.01, ours: 8.5 } }), VARIANCE_EVENTS.reopened);
    check("our figure moved: reopened", acceptanceAfter({ stands: true, accepted: at, figures: { vendor: 9, ours: 8.75 } }), VARIANCE_EVENTS.reopened);
    check("the variance is gone: cleared, whatever the figures", acceptanceAfter({ stands: false, accepted: at, figures: { vendor: 9, ours: 8.5 } }), VARIANCE_EVENTS.cleared);
    check("  and gone with the figures moved too: still cleared, not reopened", acceptanceAfter({ stands: false, accepted: at, figures: { vendor: 8.5, ours: 8.5 } }), VARIANCE_EVENTS.cleared);
    check("a cache with no Accepted row under it stands on nothing", acceptanceAfter({ stands: true, accepted: null, figures: { vendor: 9, ours: 8.5 } }), VARIANCE_EVENTS.reopened);
    check("  a blank figure is not a figure of zero", acceptanceAfter({ stands: true, accepted: { vendor: null, ours: 10 }, figures: { vendor: 0, ours: 10 } }), VARIANCE_EVENTS.reopened);

    log("");
    log("   each kind's figures are its own:");
    const ordered = { qty: 10, unitPrice: 8.5, invoicedQty: 15 };
    const before = { qty: 12, unitPrice: 9 };
    check("price: the item's unit price and the order's", JSON.stringify(varianceFigures("price", { item: before, orderedItem: ordered })), JSON.stringify({ vendor: 9, ours: 8.5 }));
    check("quantity: the item's own Qty and the order's — never Invoiced Qty", JSON.stringify(varianceFigures("quantity", { item: before, orderedItem: ordered })), JSON.stringify({ vendor: 12, ours: 10 }));
    check("totals: Invoice Total and Calculated Total", JSON.stringify(varianceFigures("totals", { invoice: { invoiceTotal: 100, calculatedTotal: 99 } })), JSON.stringify({ vendor: 100, ours: 99 }));
    const qtyEdited = { ...before, qty: 13 };
    const priceEdited = { ...before, unitPrice: 9.5 };
    const after = (kind, item, orderedItem = ordered) => {
        const was = varianceFigures(kind, { item: before, orderedItem: ordered });
        return acceptanceAfter({ stands: true, accepted: was, figures: varianceFigures(kind, { item, orderedItem }) });
    };
    check("a quantity edit leaves a price acceptance standing", after("price", qtyEdited), null);
    check("  and reopens a quantity one", after("quantity", qtyEdited), VARIANCE_EVENTS.reopened);
    check("a price edit leaves a quantity acceptance standing", after("quantity", priceEdited), null);
    check("  and reopens a price one", after("price", priceEdited), VARIANCE_EVENTS.reopened);
    check(
        "another invoice charging the same ordered item does not reopen this one",
        after("quantity", before, { ...ordered, invoicedQty: 18 }),
        null
    );

    log("");
    log("   a row's state, and a folded row's:");
    check("a flag clear with a cache set draws nothing", varianceState({ hasPriceVariance: false, priceVarianceAccepted: true }, "price"), null);
    check("a flag set and accepted", varianceState({ hasPriceVariance: true, priceVarianceAccepted: true }, "price"), "accepted");
    check("a flag set and not", varianceState({ totalsDiffer: true }, "totals"), "open");
    check("a fold is open while a half nobody accepted carries one", foldVarianceStates(["accepted", "open"]), "open");
    check("  accepted once every half carrying one is", foldVarianceStates(["accepted", null]), "accepted");
    check("  and nothing where no half carries one", foldVarianceStates([null, null]), null);
    const folded = foldInvoiceItems([
        { id: "r1", materialRecordId: "m1", unitPrice: 9, qty: 10, hasPriceVariance: true, priceVarianceAccepted: true },
        { id: "r2", materialRecordId: "m1", unitPrice: 9, qty: 2, hasPriceVariance: true, priceVarianceAccepted: false },
    ]);
    check("the items table's fold applies it", `${folded.length} ${folded[0].priceVariance} ${folded[0].quantityVariance}`, "1 open null");

    log("");
    log("   which row a mark speaks from:");
    const rows = [
        entry(999, "price", VARIANCE_EVENTS.accepted, "itA"),
        entry(1000, "price", VARIANCE_EVENTS.reopened, "itA"),
        entry(2, "price", VARIANCE_EVENTS.accepted, "itB"),
        entry(3, "totals", VARIANCE_EVENTS.accepted, null),
    ];
    check("the latest is by sequence, -1000 after -999 and not before it", latestVarianceEntry(rows, "price", "itA")?.event, VARIANCE_EVENTS.reopened);
    check("  one item's rows are not another's", latestVarianceEntry(rows, "price", "itB")?.invoiceVarianceLogId, "HYE-INV-261113-01-002");
    check("  and the invoice's totals rows name no item", latestVarianceEntry(rows, "totals")?.invoiceVarianceLogId, "HYE-INV-261113-01-003");
    check(
        "  so a totals row naming an item is not the invoice's",
        latestVarianceEntry([...rows, entry(7, "totals", VARIANCE_EVENTS.reopened, "itA")], "totals")?.invoiceVarianceLogId,
        "HYE-INV-261113-01-003"
    );
    check("an open mark reopened says when", varianceNote(rows, "price", ["itA"], "open")?.kind, "reopened");
    check("an accepted mark says who, when and why", JSON.stringify(varianceNote(rows, "price", ["itB"], "accepted")), JSON.stringify({ kind: "accepted", by: "usrA", at: rows[2].eventAt, reason: "agreed with the vendor" }));
    check("an accepted mark whose last row is not an Accepted one names nobody", varianceNote(rows, "price", ["itA"], "accepted"), null);
    check("an open mark whose last row cleared says nothing", varianceNote([entry(4, "price", VARIANCE_EVENTS.cleared, "itC")], "price", ["itC"], "open"), null);

    // -----------------------------------------------------------------------
    log("");
    log("2. one place writes a flag on a stored row, and it ends what the write moves:");
    const files = [...listJsFiles(repoPath("app")), ...listJsFiles(repoPath("lib"))];
    const flagWrites = [
        ...writesOf(files, "updateInvoiceItem", ["hasPriceVariance", "hasQuantityVariance"]),
        ...writesOf(files, "updateInvoice", ["totalsDiffer"]),
    ];
    const ALLOWED_FLAGS = ["/app/invoices/new/actions.js:createInvoiceHandler", "/lib/variance.server.js:judgeInvoiceAgain"];
    check(
        "every flag write is the create action's or the re-judgment's",
        flagWrites.filter((w) => !ALLOWED_FLAGS.includes(w)).join(", ") || "none",
        "none"
    );
    check("  and both are found writing one", ALLOWED_FLAGS.filter((w) => flagWrites.includes(w)).length, 2);
    const cacheWrites = [
        ...writesOf(files, "updateInvoiceItem", ["priceVarianceAccepted", "quantityVarianceAccepted"]),
        ...writesOf(files, "updateInvoice", ["totalsDifferAccepted"]),
    ];
    check(
        "the three caches are written in lib/variance.server.js alone",
        [...new Set(cacheWrites.map((w) => w.split(":")[0]))].join(", "),
        "/lib/variance.server.js"
    );
    check("  by its two functions", [...new Set(cacheWrites.map((w) => w.split(":")[1]))].sort().join(", "), "acceptVariance, judgeInvoiceAgain");

    const edit = resolveFunction(parseFile("app/invoices/[invoiceId]/actions.js").ast, "updateInvoiceAction");
    const split = resolveFunction(parseFile("lib/overage.server.js").ast, "splitInvoiceItemForOverage");
    assert("the edit action judges the invoice again", Boolean(edit) && callsTo(edit, "judgeInvoiceAgain").length === 1);
    assert("  and names whose edit it was", Boolean(edit) && callsTo(edit, "judgeInvoiceAgain").every((c) => callPassesProperty(c, "recordedByUserId")));
    assert("an overage's split judges its items again", Boolean(split) && callsTo(split, "judgeInvoiceAgain").length === 1);
    assert(
        "  and leaves the totals alone, which it does not move",
        Boolean(split) && callsTo(split, "judgeInvoiceAgain").every((c) => callPassesProperty(c, "totals"))
    );

    const serverAst = parseFile("lib/variance.server.js").ast;
    const judge = resolveFunction(serverAst, "judgeInvoiceAgain");
    const accept = resolveFunction(serverAst, "acceptVariance");
    const position = (fn, name) => callsTo(fn, name)[0]?.start ?? -1;
    const cacheClears = (fn) =>
        [...callsTo(fn, "updateInvoiceItem"), ...callsTo(fn, "updateInvoice")].filter((c) =>
            ["priceVarianceAccepted", "quantityVarianceAccepted", "totalsDifferAccepted"].some((p) => callPassesProperty(c, p)) ||
            c.arguments[1]?.properties?.some((p) => p.computed)
        );
    assert(
        "an ending's row is written before its cache is cleared",
        Boolean(judge) && cacheClears(judge).length >= 2 && cacheClears(judge).every((c) => position(judge, "recordEnding") < c.start)
    );
    assert(
        "an acceptance's row is written before its cache is set",
        Boolean(accept) && cacheClears(accept).length >= 2 && cacheClears(accept).every((c) => position(accept, "createInvoiceVarianceLogEntry") < c.start)
    );
    assert("  and a cache that fails takes the row back out", Boolean(accept) && callsTo(accept, "destroyInvoiceVarianceLogEntries").length === 1);

    // -----------------------------------------------------------------------
    log("");
    log("3. the control is the office's and the fact is everybody's (#185):");
    const marks = parseFile("app/invoices/[invoiceId]/VarianceAcceptance.js").ast;
    for (const name of ["VarianceMark", "TotalsVariance"]) {
        const fn = resolveFunction(marks, name);
        assert(`${name} resolves`, Boolean(fn));
        if (!fn) continue;
        const controls = [...guardedElements(fn, "button", "canAccept"), ...guardedElements(fn, "AcceptForm", "canAccept")];
        check(`  ${name}'s button and form are behind canAccept`, `${controls.length} ${controls.filter((c) => !c.guarded).length}`, "2 0");
        const notes = guardedElements(fn, "AcceptanceNote", "canAccept");
        check(`  and what it says is not`, `${notes.length} ${notes.filter((c) => c.guarded).length}`, "1 0");
    }
    const page = parseFile("app/invoices/[invoiceId]/page.js").ast;
    const handed = [];
    walk(page, (node) => {
        if (node.type === "JSXAttribute" && node.name?.name === "canAccept") {
            const v = node.value?.expression;
            handed.push(v?.type === "MemberExpression" ? `${v.object.name}.${v.property.name}` : "?");
        }
    });
    check("the page hands every mark user.isAdmin", `${handed.length} ${[...new Set(handed)].join(",")}`, "2 user.isAdmin");
    const actionsAst = parseFile("app/invoices/[invoiceId]/actions.js").ast;
    let wrapper = null;
    walk(actionsAst, (node) => {
        if (node.type === "VariableDeclarator" && node.id?.name === "acceptVarianceAction") wrapper = node.init?.callee?.name;
    });
    check("  and the action it posts to is withAdminAction", wrapper, "withAdminAction");
    // ANTI-VACUITY: the guard reader sees an unguarded control when there is one.
    const planted = parseSource(
        "function VarianceMark({ canAccept }) { return <>{<button />}{canAccept && <AcceptForm />}<AcceptanceNote /></>; }",
        "<planted>"
    ).ast;
    const plantedFn = resolveFunction(planted, "VarianceMark");
    check(
        "  a planted unguarded button is seen",
        guardedElements(plantedFn, "button", "canAccept").filter((c) => !c.guarded).length,
        1
    );

    // -----------------------------------------------------------------------
    log("");
    log("4. the payment check asks, lists what is open, and states the wait as information:");
    const lines = openVariances({
        folded: [
            { key: "a", label: "Gate valve 2 in", priceVariance: "open", quantityVariance: "accepted" },
            { key: "b", label: "Elbow", priceVariance: "accepted", quantityVariance: null },
        ],
        invoice: { totalsDiffer: true, totalsDifferAccepted: false },
    });
    check(
        "an open variance is listed by its badge and its item, an accepted one is not",
        lines.map((l) => l.text).join(" | "),
        `${VARIANCE_COPY.price} — Gate valve 2 in | ${VARIANCE_COPY.totalsDiffer}`
    );
    check("  an accepted totals difference is not either", openVariances({ folded: [], invoice: { totalsDiffer: true, totalsDifferAccepted: true } }).length, 0);
    const payment = parseFile("app/invoices/[invoiceId]/PaymentSection.js");
    let ask = null;
    walk(payment.ast, (node) => {
        if (node.type === "FunctionDeclaration" && node.id?.name === "askFirst") ask = node;
    });
    assert("the question stops the submission", Boolean(ask) && callsTo(ask, "preventDefault").length === 1);
    let form = null;
    walk(payment.ast, (node) => {
        if (node.type === "JSXElement" && node.openingElement.name.name === "form") form = node;
    });
    const onSubmit = form?.openingElement.attributes.find((a) => a.name?.name === "onSubmit")?.value?.expression?.name;
    check("  as the form's onSubmit, so Enter in the field asks too", onSubmit, "askFirst");
    let deliveryClass = null;
    walk(payment.ast, (node) => {
        if (node.type !== "JSXElement" || node.openingElement.name.name !== "li") return;
        let names = false;
        walk(node, (n) => {
            if (n.type === "MemberExpression" && n.property?.name === "delivery") names = true;
        });
        if (!names) return;
        const cls = node.openingElement.attributes.find((a) => a.name?.name === "className");
        deliveryClass = cls?.value?.value ?? null;
    });
    assert("the delivery's sentence is drawn", deliveryClass !== null);
    assert("  in neither red nor amber", deliveryClass !== null && !/red|amber/.test(deliveryClass));
    const confirms = [];
    walk(payment.ast, (node) => {
        if (node.type !== "JSXElement" || node.openingElement.name.name !== "button") return;
        let says = false;
        walk(node, (n) => {
            if (n.type === "MemberExpression" && n.object?.name === "PAYMENT_CHECK_COPY" && n.property?.name === "confirm") says = true;
        });
        if (!says) return;
        confirms.push(node.openingElement.attributes.find((a) => a.name?.name === "type")?.value?.value);
    });
    check("the confirming button is a submit and says so", confirms.join(","), "submit");
    assert("  in words of its own", PAYMENT_CHECK_COPY.confirm === "Save payment anyway");

    // -----------------------------------------------------------------------
    log("");
    log("5. the words:");
    for (const kind of ["price", "quantity", "totals"]) {
        const open = kind === "totals" ? VARIANCE_COPY.totalsDiffer : VARIANCE_COPY[kind];
        const accepted = ACCEPTANCE_COPY.badge[kind];
        assert(`${kind}: the open badge is the kind's word marked`, open === `⚠ ${VARIANCE_KINDS[kind]}`);
        assert(`  the accepted badge leads with the same word`, accepted.startsWith(VARIANCE_KINDS[kind]));
        assert(`  carries no warning mark`, !accepted.includes("⚠"));
        assert(`  and is not the open badge`, accepted !== open);
    }
    const choices = schemaChoices();
    check("the schema's Variance choices are the words the code writes", (choices.VARIANCE_CHOICES || []).join(", "), VARIANCE_KIND_VALUES.join(", "));
    check("the schema's Event choices are the events the code writes", (choices.EVENT_CHOICES || []).join(", "), VARIANCE_EVENT_VALUES.join(", "));
    check("  three events, Cleared among them", VARIANCE_EVENT_VALUES.join(", "), "Accepted, Reopened, Cleared");
    assert("a reason is required, in the app's words", ACCEPTANCE_COPY.refusals.reason === "Reason is required.");
}

if (isMain(import.meta.url)) standalone(title, run);
