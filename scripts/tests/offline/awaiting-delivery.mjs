// The invoices waiting on a delivery are selected, split and ordered (#256).
//
// THE QUIET MUTANT IS A SELECTION RULE THAT ALWAYS RETURNS NOTHING, and it is
// asserted first. Make `selectInvoicesAwaitingDelivery` return `[]` and the strip
// renders nowhere, because rendering nothing when there is nothing is the shape every
// strip in this app has — so the page looks exactly as it does on the good day, the
// invoice list is untouched, and no other check in this tier notices. It is the same
// station as #237's `always agree`, #242's removed narrowing, #241's always-silent
// list, #238's unfolded table and #179's two constants holding one value: a screen
// that is correct in every visible respect and has stopped saying the one thing it
// was built to say.
//
// TWO MORE MUTANTS BEHIND IT, both invisible the same way: a splitter that always
// returns one row kind (every row then reads `nothing delivered yet`, which is a
// plausible state), and a sort that returns its input order (the rows are all there
// and only their order is wrong, which nobody can eyeball against 14 rows).
//
// WHAT THIS CANNOT SEE: whether the strip renders, and whether the read that feeds
// `deliveredOrderedItems` returns the right ids. The first is rendering and this tier
// never renders; the second is credentialed. Both were checked in a browser and the
// finding is in the pull request.

import { walk } from "./_ast.mjs";
import { parseFile } from "./_ast.mjs";
import {
    AWAITING_DELIVERY_COPY,
    AWAITING_DELIVERY_DAYS,
    AWAITING_DELIVERY_KIND,
    daysWaiting,
    hasWaitedLongEnough,
    selectInvoicesAwaitingDelivery,
} from "../../../lib/deliveryStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The invoices waiting on a delivery: selection, split, order, threshold (#256, #263)";

/**
 * The `AWAITING_DELIVERY_COPY.explain` node, and every numeric literal under it.
 *
 * WHY THIS IS ASKED ON THE SOURCE. The threshold sentence must take its figure from
 * `AWAITING_DELIVERY_DAYS` rather than spell it, and no runtime comparison can tell
 * the two apart while they agree: `explain.includes(String(AWAITING_DELIVERY_DAYS))`
 * passes just as happily on a hard-coded `7`. The two homes are then real and silent
 * until somebody changes the constant, at which point the filter is exact and the
 * screen claims the old number — which is #263's named mutant. `auth-token-state.mjs`
 * checks the same property with `includes` plus a value pin, and that pair only fires
 * once the two have already diverged; this fires when the second home appears.
 */
function explainCopySource() {
    const { ast } = parseFile("lib/deliveryStatus.js");
    let node = null;
    walk(ast, (n) => {
        if (node || n.type !== "VariableDeclarator") return;
        if (n.id?.name !== "AWAITING_DELIVERY_COPY") return;
        walk(n.init, (p) => {
            if (node || p.type !== "Property") return;
            if ((p.key?.name ?? p.key?.value) === "explain") node = p.value;
        });
    });
    if (!node) return null;
    const templateRefs = [];
    const numbers = [];
    const staticText = [];
    walk(node, (n) => {
        if (n.type === "TemplateLiteral") {
            for (const e of n.expressions || []) {
                if (e.type === "Identifier") templateRefs.push(e.name);
            }
        }
        if (n.type === "Literal" && typeof n.value === "number") numbers.push(n.value);
        // THE STATIC TEXT IS COLLECTED BECAUSE THE FIRST VERSION OF THIS FUNCTION
        // MISSED THE MUTANT IT EXISTS FOR, and running it is what showed that. Spelling
        // the figure in the sentence writes `"…waited 7 days…"` — a STRING literal, so
        // the numeric scan below saw nothing and reported "spells no number of its
        // own" while the sentence spelled it. A number in copy is prose, not a number.
        if (n.type === "Literal" && typeof n.value === "string") staticText.push(n.value);
        if (n.type === "TemplateElement") staticText.push(n.value.cooked ?? "");
    });
    return { templateRefs, numbers, staticText };
}

/** Every numeric literal in the constant's own declaration, for the scan's positive case. */
function thresholdDeclarationNumbers() {
    const { ast } = parseFile("lib/deliveryStatus.js");
    const numbers = [];
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.name !== "AWAITING_DELIVERY_DAYS") return;
        walk(n.init, (p) => {
            if (p.type === "Literal" && typeof p.value === "number") numbers.push(p.value);
        });
    });
    return numbers;
}

const AWAITING = { key: "awaiting-delivery" };
const MATCHED = { key: "delivered" };
const MISMATCH = { key: "mismatch" };

/** An invoice record as the page holds it. */
const inv = (invoiceId, issueDate, vendor = "vendorA") => ({
    id: `rec-${invoiceId}`,
    invoiceId,
    issueDate,
    vendor: [vendor],
});

const VENDORS = { vendorA: "Demo Vendor Co.", vendorB: "Other Vendor" };
const TODAY = "2026-08-18";

/** The whole call, with only what a case varies. */
function select({ invoices, status, ordered, delivered = [] }) {
    return selectInvoicesAwaitingDelivery({
        invoices,
        statusByInvoice: new Map(invoices.map((i) => [i.id, status[i.invoiceId] ?? AWAITING])),
        orderedItemsByInvoice: new Map(
            invoices.map((i) => [i.id, ordered[i.invoiceId] ?? ["poItem-1"]])
        ),
        deliveredOrderedItems: new Set(delivered),
        vendorNameById: VENDORS,
        today: TODAY,
    });
}

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("THE QUIET MUTANT — a selection rule that always returns nothing:");
    const a = inv("HYE-INV-260701-01", "2026-07-01");
    const b = inv("HYE-INV-260801-01", "2026-08-01");
    const baseline = select({ invoices: [a, b], status: {}, ordered: {} });
    // Asserted before anything else, because every check below this one is of the form
    // "the rows are shaped so" and an empty list satisfies all of them vacuously.
    assert("an awaiting invoice is SELECTED at all", baseline.length > 0);
    check("both awaiting invoices are selected", baseline.length, 2);
    log("  a selector returning [] passes every ordering and shape check below");

    // -----------------------------------------------------------------------
    // #263's OWN QUIET MUTANT, AND IT SITS SECOND RATHER THAN FIRST DELIBERATELY.
    // It is: the threshold exists as a constant, the sentence states a number, and the
    // two are different values — the filter is exact while the screen claims something
    // else, and nothing fails. It cannot go above the assertion just made, because a
    // selector returning nothing passes every threshold assertion below as vacuously
    // as it passes the ordering ones; the empty-selector mutant has to be excluded
    // first or this section is checking a list it never saw.
    log("");
    log("#263 THE THRESHOLD SENTENCE HAS ONE HOME — asserted on the source:");
    const copySource = explainCopySource();
    assert("the explain property was found in the source", copySource !== null);
    assert(
        `  it interpolates AWAITING_DELIVERY_DAYS rather than spelling ${AWAITING_DELIVERY_DAYS}`,
        copySource?.templateRefs.includes("AWAITING_DELIVERY_DAYS")
    );
    check(
        "  and spells no number of its own",
        (copySource?.numbers ?? []).join(",") || "none",
        "none"
    );
    // AND NOT IN THE PROSE EITHER, which is where a spelled figure actually goes. Both
    // halves are needed: `${7}` is a numeric literal and `"7 days"` is a string one,
    // and only the second is what somebody would really write.
    const spelledInProse = (copySource?.staticText ?? []).filter((s) =>
        new RegExp(`\\b${AWAITING_DELIVERY_DAYS}\\b`).test(s)
    );
    check(
        "  nor spells it in the prose",
        spelledInProse.join(" | ") || "none",
        "none"
    );
    // ANTI-VACUITY, AND THE NUMERIC SCAN NEEDS IT MOST: "no number under `explain`" and
    // "the scan cannot see a number" print the same result. So the same scan is run
    // where a literal legitimately IS — the constant's own declaration — and has to
    // find it there.
    check(
        "the numeric scan finds the literal where it belongs",
        thresholdDeclarationNumbers().join(","),
        String(AWAITING_DELIVERY_DAYS)
    );
    // And the sentence really does end up stating the figure at runtime, which is the
    // half the source check does not cover: a template referencing the right identifier
    // could still be built into a string nobody renders.
    assert(
        "the rendered sentence carries the figure",
        AWAITING_DELIVERY_COPY.explain.includes(String(AWAITING_DELIVERY_DAYS))
    );
    check("the threshold itself", AWAITING_DELIVERY_DAYS, 7);

    // -----------------------------------------------------------------------
    log("");
    log("#263 the threshold decides membership, at the boundary and below it:");
    // CALENDAR DAYS, which is what `daysWaiting` counts and therefore what the
    // threshold has to be in. The three cases are the boundary, one short of it, and
    // the data gap — every branch `hasWaitedLongEnough` has.
    check(`exactly ${AWAITING_DELIVERY_DAYS} days waits long enough`, hasWaitedLongEnough(AWAITING_DELIVERY_DAYS), true);
    check("  one day short does not", hasWaitedLongEnough(AWAITING_DELIVERY_DAYS - 1), false);
    check("  a longer wait does", hasWaitedLongEnough(AWAITING_DELIVERY_DAYS + 40), true);
    check("  zero days does not", hasWaitedLongEnough(0), false);
    // A NULL WAIT IS REFUSED, which is #263's third decision and the same direction
    // `sortLongestWaitingFirst` already took on an undated row (pinned on that function
    // in offline/delivery-status.mjs). The strip claims "this has waited long enough";
    // an invoice with no `Issue Date` has not been shown to have waited at all.
    check("  and a null wait does not", hasWaitedLongEnough(null), false);
    check("  nor undefined", hasWaitedLongEnough(undefined), false);
    check("  nor NaN", hasWaitedLongEnough(NaN), false);
    // The predicate is fed by `daysWaiting`, so the null path has to actually connect:
    // a blank date counts to null there, which is what reaches the refusal above.
    check("a blank Issue Date counts to null", daysWaiting("", TODAY), null);

    // Through the selector, which is where it decides anything.
    const onBoundary = inv("HYE-INV-260811-01", "2026-08-11"); // 7 days before TODAY
    const shortOfIt = inv("HYE-INV-260813-01", "2026-08-13"); // 5 days before TODAY
    const noDate = inv("HYE-INV-260101-01", "");
    const filtered = select({ invoices: [a, onBoundary, shortOfIt, noDate], status: {}, ordered: {} });
    check(
        "the selector keeps the boundary and drops the rest",
        filtered.map((r) => r.invoiceId).join(" "),
        `${a.invoiceId} ${onBoundary.invoiceId}`
    );
    // ANTI-VACUITY FOR THE FILTER, AND THE CHECK BELOW CARRIES ALL OF IT. The dropped
    // rows have to be rows the selector would otherwise have returned, or this section
    // is measuring the ordered-item guard instead — and the one thing that shows it is
    // re-running the SAME row with nothing changed but `today`. A second call at the
    // fixed `TODAY` proves nothing the assertion above has not already said, so there
    // is deliberately no companion assertion here: the date-moved call is the whole
    // anti-vacuity.
    check(
        "  and it is the DATE that excluded it",
        selectInvoicesAwaitingDelivery({
            invoices: [shortOfIt],
            statusByInvoice: new Map([[shortOfIt.id, AWAITING]]),
            orderedItemsByInvoice: new Map([[shortOfIt.id, ["poItem-1"]]]),
            deliveredOrderedItems: new Set(),
            vendorNameById: VENDORS,
            today: "2026-09-30",
        }).length,
        1
    );
    // THE THRESHOLD IS ONE RULE FOR BOTH ROW KINDS (#263). `deliveredNotMatched` looks
    // like it should skip the wait — something arrived and only the pairing is missing —
    // but the flag means "some slice against SOME ordered item, any quantity, any
    // delivery, possibly another invoice's". The measured pair is in
    // lib/deliveryReconciliation.js:getOrderedItemsWithDelivery.
    const bothKindsShort = select({
        invoices: [shortOfIt, inv("HYE-INV-260813-02", "2026-08-13")],
        status: {},
        ordered: { [shortOfIt.invoiceId]: ["poItem-9"] },
        delivered: ["poItem-9"],
    });
    check("neither kind is exempt from the wait", bothKindsShort.length, 0);
    // ANTI-VACUITY: that call has to be one where a kind split really would happen.
    const bothKindsWaited = select({
        invoices: [a, b],
        status: {},
        ordered: { [a.invoiceId]: ["poItem-9"] },
        delivered: ["poItem-9"],
    });
    check("  and the same shapes past the threshold give two kinds", new Set(bothKindsWaited.map((r) => r.kind)).size, 2);

    // -----------------------------------------------------------------------
    log("");
    log("selection is the chip's own key, not a second reading of the link:");
    check(
        "a matched invoice is not selected",
        select({ invoices: [a, b], status: { [a.invoiceId]: MATCHED }, ordered: {} }).length,
        1
    );
    check(
        "a mismatched invoice is not selected either — it HAS a delivery",
        select({ invoices: [a, b], status: { [a.invoiceId]: MISMATCH }, ordered: {} }).length,
        1
    );
    // Built inline rather than through the helper, whose `?? AWAITING` default is
    // exactly what this case has to defeat: an invoice the status map never mentions.
    check(
        "an invoice with no summary at all is not selected",
        selectInvoicesAwaitingDelivery({
            invoices: [a],
            statusByInvoice: new Map(),
            orderedItemsByInvoice: new Map([[a.id, ["poItem-1"]]]),
            deliveredOrderedItems: new Set(),
            vendorNameById: VENDORS,
            today: TODAY,
        }).length,
        0
    );

    // -----------------------------------------------------------------------
    log("");
    log("an invoice charging no ordered item is excluded, and the count may differ:");
    check(
        "no ordered item means no row",
        select({ invoices: [a], status: {}, ordered: { [a.invoiceId]: [] } }).length,
        0
    );
    // THE DIVERGENCE THIS CREATES, PINNED. The table below the strip shows an
    // `Awaiting delivery` chip for such an invoice and the strip has no row for it, so the
    // two figures disagree by design — see the selector's docstring and
    // docs/briefs/invoices.md, both of which say so in as many words.
    const withUnlinked = select({
        invoices: [a, b],
        status: {},
        ordered: { [a.invoiceId]: [] },
    });
    check("two chips, one row", `${2}/${withUnlinked.length}`, "2/1");
    assert("  and the row is the one that charges an order", withUnlinked[0].invoiceId === b.invoiceId);

    // -----------------------------------------------------------------------
    log("");
    log("the split names the observation, never the cause:");
    const split = select({
        invoices: [a, b],
        status: {},
        ordered: { [a.invoiceId]: ["poItem-1"], [b.invoiceId]: ["poItem-2", "poItem-3"] },
        delivered: ["poItem-3"],
    });
    const kindOf = (id) => split.find((r) => r.invoiceId === id)?.kind;
    check(
        "nothing delivered against its orders",
        kindOf(a.invoiceId),
        AWAITING_DELIVERY_KIND.noDeliveryRecorded
    );
    check(
        "one of several ordered items has a delivery",
        kindOf(b.invoiceId),
        AWAITING_DELIVERY_KIND.deliveredNotMatched
    );
    // ANY, NOT ALL: one slice against one of the ordered items is enough for a person
    // to have something to look at, and requiring all of them would put a partly
    // delivered invoice in the "nothing delivered" kind, which is the misreading the two
    // words exist to prevent.
    assert(
        "  ANY ordered item with a delivery is enough",
        kindOf(b.invoiceId) === AWAITING_DELIVERY_KIND.deliveredNotMatched
    );
    // THE SPLITTER MUTANT: always one kind. Both keys have to be reachable from one
    // call, or "every row says the same thing" reads as a real state of the base.
    assert("both kinds are reachable in one selection", new Set(split.map((r) => r.kind)).size === 2);

    // -----------------------------------------------------------------------
    log("");
    log("the order is longest wait first, shared with the other two strips:");
    // WAS `2026-08-15` UNTIL #263 AND THAT IS THE THRESHOLD'S DOING, not a fixture
    // tidy-up: three days before `TODAY` is inside the wait now, so the row this case
    // needs as its newest would have been filtered out and the ordering would have been
    // asserted over two rows. Moved clear of the boundary rather than onto it, so a
    // future change to the threshold cannot break an ordering test for an unrelated
    // reason — the boundary has its own cases in the section above.
    const c = inv("HYE-INV-260808-01", "2026-08-08");
    const ordered3 = select({ invoices: [b, c, a], status: {}, ordered: {} });
    check(
        "oldest Issue Date first",
        ordered3.map((r) => r.invoiceId).join(" "),
        `${a.invoiceId} ${b.invoiceId} ${c.invoiceId}`
    );
    // THE SORT MUTANT: return the input order. The input here is deliberately NOT
    // sorted, so a passthrough fails this and only this.
    assert("  the input was not already in that order", [b, c, a][0].invoiceId !== a.invoiceId);
    // THE UNDATED CASE LEFT THIS SECTION IN #263, and it is a deletion rather than a
    // move: an undated invoice is no longer selected at all, so there is no row here
    // whose position could be asserted. What it used to prove still is, one level down
    // and where it belongs — `offline/delivery-status.mjs` pins "an undated row sorts
    // LAST, not first" on `sortLongestWaitingFirst` itself, and the refusal that now
    // keeps such a row out of this list is pinned in the threshold section above.

    // -----------------------------------------------------------------------
    log("");
    log("two invoices issued on one day break the tie on Invoice ID:");
    // THE TIE-BREAK WAS INERT ON THIS AXIS UNTIL THE SECOND PASS, and inertly so:
    // `sortLongestWaitingFirst` read `createdAt`, `Invoices` has no such field, so
    // every same-day pair silently held whatever order the invoice read returned. The
    // id serves because its date half is the mint moment rather than the vendor's
    // `Issue Date` (#164), so descending by it is the delivery side's `createdAt`
    // descending — most recently entered first.
    const sameDay = select({
        invoices: [inv("HYE-INV-260716-02", "2026-07-16"), inv("HYE-INV-260716-03", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check(
        "the later id reads first",
        sameDay.map((r) => r.invoiceId).join(" "),
        "HYE-INV-260716-03 HYE-INV-260716-02"
    );
    // Fed in the other order, to prove it is the sort deciding and not the input.
    const sameDayReversed = select({
        invoices: [inv("HYE-INV-260716-03", "2026-07-16"), inv("HYE-INV-260716-02", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check(
        "  and the input order does not decide it",
        sameDayReversed.map((r) => r.invoiceId).join(" "),
        "HYE-INV-260716-03 HYE-INV-260716-02"
    );
    // Across days the wait still wins: a tie-break that outranked the primary key
    // would put a newer invoice above an older one, which is the whole worklist inverted.
    const acrossDays = select({
        invoices: [inv("HYE-INV-260801-09", "2026-08-01"), inv("HYE-INV-260716-01", "2026-07-16")],
        status: {},
        ordered: {},
    });
    check("the wait outranks the id", acrossDays[0].invoiceId, "HYE-INV-260716-01");
    assert("the row carries the id as its creation key", sameDay[0].createdKey === sameDay[0].invoiceId);

    // -----------------------------------------------------------------------
    log("");
    log("the row carries the date beside the count, and the count is days:");
    check("days from Issue Date to today", baseline[0].daysWaiting, 48);
    check("  and the date itself travels for checking", baseline[0].waitingSince, "2026-07-01");
    // THE BLANK-DATE ROW IS GONE FROM THIS SECTION TOO (#263) — it is not selected, so
    // there is no row to read a null off. `daysWaiting("", TODAY)` is asserted directly
    // in the threshold section above, which is the function that produces the null and
    // the only thing this case was ever really about.
    // And the count is per row rather than one figure for the list: the second row of
    // the same call carries its own.
    check("  the second row counts from its own date", baseline[1].daysWaiting, 17);
    check("the vendor is resolved", baseline[0].vendorName, "Demo Vendor Co.");
    check(
        "an unknown vendor does not blank the row",
        select({ invoices: [inv("HYE-INV-260701-02", "2026-07-01", "gone")], status: {}, ordered: {} })[0]
            .vendorName,
        "Unknown vendor"
    );

    // -----------------------------------------------------------------------
    log("");
    log("the copy: one voice, no control named, no cause claimed:");
    check("singular heading", AWAITING_DELIVERY_COPY.heading(1), "1 invoice is waiting on a delivery");
    check("plural heading", AWAITING_DELIVERY_COPY.heading(4), "4 invoices are waiting on a delivery");
    assert("the explain line leads with the ordering", AWAITING_DELIVERY_COPY.explain.startsWith("Longest wait first."));
    // NAMES NO CONTROL, asserted the way offline/delivery-status.mjs asserts it for
    // #216's copy: the day it does is the day two voices are needed, because recording
    // a delivery is Job-scoped and this strip is not.
    const words = `${AWAITING_DELIVERY_COPY.heading(2)} ${AWAITING_DELIVERY_COPY.explain} ${Object.values(AWAITING_DELIVERY_COPY.kind).join(" ")}`;
    for (const control of ["Record a delivery", "Record delivery", "New invoice", "click", "button"]) {
        assert(`  says nothing about \`${control}\``, !words.includes(control));
    }
    // AND CLAIMS NO CAUSE. `fitRefusal` is never stored and runs only at write time,
    // so any of these words would be false about an invoice the matcher was never asked
    // about — which, per docs/notes/backlog.md, is most of this base's rows.
    for (const cause of ["refused", "rejected", "could not", "failed", "mismatch"]) {
        assert(`  claims no cause: \`${cause}\``, !words.toLowerCase().includes(cause));
    }
    // AND NO INSTRUCTION ABOUT PAYING, which is President-or-Admin (#211) while this
    // strip is not.
    for (const pay of ["pay", "Paid", "payment"]) {
        assert(`  gives no instruction about \`${pay}\``, !words.includes(pay));
    }

    // -----------------------------------------------------------------------
    log("");
    log("both row words exist and are distinct:");
    check("two kinds, two words", Object.keys(AWAITING_DELIVERY_COPY.kind).length, 2);
    assert(
        "every kind has a word",
        Object.values(AWAITING_DELIVERY_KIND).every((k) => typeof AWAITING_DELIVERY_COPY.kind[k] === "string")
    );
    assert(
        "  and the two words differ",
        AWAITING_DELIVERY_COPY.kind[AWAITING_DELIVERY_KIND.noDeliveryRecorded] !==
            AWAITING_DELIVERY_COPY.kind[AWAITING_DELIVERY_KIND.deliveredNotMatched]
    );
    // #227's vocabulary, on new screen text: a delivery is delivered, never arrived.
    for (const banned of ["arrived", "arrival"]) {
        assert(`  and neither says \`${banned}\``, !words.includes(banned));
    }

    // -----------------------------------------------------------------------
    log("");
    log("the strip file is rendering only — the judgment is in lib:");
    const { ast } = parseFile("app/invoices/AwaitingDeliveryStrip.js");
    const called = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type === "Identifier") called.add(callee.name);
        if (callee?.type === "MemberExpression" && callee.property?.name) called.add(callee.property.name);
    });
    assert("the strip walk found calls at all", called.size > 0);
    // It may map and read copy; it may not select, split or sort. Those three are the
    // judgment, and #216 recorded that a strip re-deriving one is how #176's pattern
    // went wrong.
    for (const judgment of ["sort", "filter", "selectInvoicesAwaitingDelivery", "daysWaiting"]) {
        assert(`  does not call \`${judgment}\``, !called.has(judgment));
    }

    // #263's SECOND MUTANT: THE HEADING COUNTS ONE ARRAY AND THE LIST RENDERS ANOTHER.
    // The threshold made this reachable in a way it was not before — a filter is now a
    // thing somebody might reasonably reach for on this page, and put in the wrong
    // place. `does not call filter` above catches it inside this component; it does not
    // catch a heading counting `rows` while the list maps something derived from it. So
    // both are asserted on the shape: the count is `rows.length` and the list maps
    // `rows` itself, which is what makes the two figures the same figure.
    let headingArg = null;
    let mapObject = null;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const p = node.callee?.property?.name;
        if (p === "heading" && node.arguments.length === 1) {
            const arg = node.arguments[0];
            headingArg = `${arg?.object?.name ?? "?"}.${arg?.property?.name ?? "?"}`;
        }
        if (p === "map") mapObject = node.callee?.object?.name ?? "(an expression)";
    });
    check("the heading counts `rows.length`", headingArg, "rows.length");
    check("  and the list maps `rows` itself", mapObject, "rows");
    // ANTI-VACUITY: both matchers had to find their call. A null on either would print
    // as a mismatch above, but only after somebody read the value — this says it plainly.
    assert("both shape matchers found their call", headingArg !== null && mapObject !== null);

    // -----------------------------------------------------------------------
    log("");
    log("anti-vacuity — the mutants above are seen to be catchable:");
    // Every "no X" assertion has a twin that shows the mechanism can see an X.
    assert("the copy string under test is non-empty", words.length > 40);
    assert("  and the control matcher finds a word that IS there", words.includes("Longest"));
    assert("  and the cause matcher would catch one", "a refused pairing".includes("refused"));
    assert("the strip's call set really holds its calls", called.has("heading") || called.has("map"));
    assert("  and the judgment matcher would catch a sort", ["sort"].some((j) => new Set(["sort"]).has(j)));
    assert("the selector returns rows, not just a length", typeof baseline[0].invoiceId === "string");
    assert("  and a mutant returning [] fails the first assertion above", select({ invoices: [], status: {}, ordered: {} }).length === 0);
}

if (isMain(import.meta.url)) await standalone(title, run);
